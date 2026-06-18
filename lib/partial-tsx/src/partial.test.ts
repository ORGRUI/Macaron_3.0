import { describe, expect, test } from "bun:test";
import { completePartialTsx, normalizeGeneratedTsx } from "./partial";

describe("completePartialTsx", () => {
  test("closes streamed JSX tags", () => {
    expect(completePartialTsx("<div><p><span>Deep")).toBe("<div><p><span>Deep</span></p></div>");
  });

  test("completes an unterminated string attribute on a trailing incomplete tag", () => {
    expect(completePartialTsx('<div><p>Done</p><span className="incomp')).toBe('<div><p>Done</p><span className="incomp"></span></div>');
  });

  test("terminates parenthesized JSX return after the restored paren", () => {
    expect(completePartialTsx('function App() { return (<div><label>Ready</label><input className="bord')).toBe('function App() { return (<div><label>Ready</label><input className="bord" /></div>);}');
  });

  test("closes incomplete JS expression and JSX children together", () => {
    const code = "export default function App() { const [count, setCount] = useState(0); return <button onClick={() => setCount(count + 1)}>Count {count}";
    const completed = completePartialTsx(code);
    expect(completed).toContain("</button>");
    expect(completed.endsWith(";}")).toBe(true);
  });

  test("keeps template expressions parseable while streaming", () => {
    expect(completePartialTsx("export default function App() { const label = `hello ${name")).toBe("export default function App() { const label = `hello ${name}`;}");
  });

  test("drops a trailing incomplete const declaration before closing a function block", () => {
    expect(completePartialTsx("function App() { const")).toBe("function App() { }");
    expect(completePartialTsx("function App() { const [text, setText")).toBe("function App() { }");
    expect(completePartialTsx("function App() { const label =")).toBe("function App() { }");
    expect(completePartialTsx("function App() { constants")).toBe("function App() { constants;}");
  });

  test("drops a const initializer truncated mid-generic so `<` is not left as a comparison", () => {
    // `useState<number | null` without its `>` closer would otherwise survive as a bare `number` value reference at runtime.
    expect(completePartialTsx("function App() { const [cell, setCell] = useState<number | null")).toBe("function App() { }");
    expect(completePartialTsx("function App() { const items = useMemo<Item[]")).toBe("function App() { }");
    // A nested generic whose outer `>` hasn't streamed (`useState<Array<Item>`) is still net-unclosed and must drop too.
    expect(completePartialTsx("function App() { const rows = useState<Array<Item>")).toBe("function App() { }");
    // A bare `a < b` with no closing `>` is indistinguishable from a just-started generic call mid-stream; dropping it rolls
    // back to the previous complete frame (recovered on the next token), which is safer than risking a tolerant-parse crash.
    expect(completePartialTsx("function App() { const x = a < b")).toBe("function App() { }");
    // An arrow inside the type argument (`useCallback<(x) => void`) must not let the `=>`'s `>` close the generic early.
    expect(completePartialTsx("function App() { const cb = useCallback<(x: number) => void")).toBe("function App() { }");
    // An object-shaped type argument (`useState<{ count: number`) is a value-position generic too; rolling back also discards the
    // `{` the scanner opened for the type literal, so no stray `}` is left behind.
    expect(completePartialTsx("function App() { const state = useState<{ count: number")).toBe("function App() { }");
    // A type argument wrapped onto the next line (a common formatted streaming boundary) must still roll back.
    expect(completePartialTsx("function App() { const x = useState<\n  number | null")).toBe("function App() { }");
    // A `;`/`<` living inside a completed string literal is not a statement boundary, so the declaration before it is untouched.
    expect(completePartialTsx('function App() { const s = "hello; const x = useState<number"')).toBe('function App() { const s = "hello; const x = useState<number";}');
    // Deeply-nested type literals (`useState<{ nested: { count: number`) open several `{` frames inside the generic; the rollback
    // must discard every one of them, not just the innermost, so no stray `}` survives.
    expect(completePartialTsx("function App() { const state = useState<{ nested: { count: number")).toBe("function App() { }");
    // A mid-generic initializer nested inside an array/object literal (`[{ foo: useState<number`) rolls back the whole
    // declaration, so the enclosing `[` and `{` the scanner opened must not be closed into stray `]`/`}`.
    expect(completePartialTsx("function App() { const arr = [{ foo: useState<number")).toBe("function App() { }");
  });

  test("keeps initializers whose angle brackets are balanced or live inside literals", () => {
    // A `<` inside a string/template is not a type argument, so the declaration stays intact once its `>`-free body balances out.
    expect(completePartialTsx('function App() { const label = "a<b"')).toBe('function App() { const label = "a<b";}');
    expect(completePartialTsx("function App() { const label = `价格<100`")).toBe("function App() { const label = `价格<100`;}");
    expect(completePartialTsx("function App() { const x = a > b")).toBe("function App() { const x = a > b;}");
    // `<<`/`<=` share the `<` glyph but can't open a generic, so completed shift/comparison initializers survive intact.
    expect(completePartialTsx("function App() { const x = 1 << 2")).toBe("function App() { const x = 1 << 2;}");
    expect(completePartialTsx("function App() { const x = a <= b")).toBe("function App() { const x = a <= b;}");
    expect(completePartialTsx("function App() { const ok = items.filter((i) => i < 3)")).toBe("function App() { const ok = items.filter((i) => i < 3);}");
    expect(completePartialTsx("function App() { const [c, setC] = useState<number | null>(null)")).toBe("function App() { const [c, setC] = useState<number | null>(null);}");
  });

  test("treats ASI newlines as declaration boundaries and keeps completed earlier statements", () => {
    // A newline-separated incomplete `const b =` must roll back only itself; the completed `let a = 1` before it (no semicolon,
    // valid under ASI) must survive instead of the matcher anchoring on the first declaration and dropping everything.
    expect(completePartialTsx("let a = 1\nconst b =")).toBe("let a = 1\n");
    expect(completePartialTsx("doThing()\nconst b =")).toBe("doThing()\n");
    // A trailing `=` inside an already-open arrow body (`() => { ...; x =`) belongs to a nested statement, not the declaration's
    // own initializer, so the whole `const measureLayout` must not be rolled back — its block frame is closed normally.
    expect(completePartialTsx("function App() { const measureLayout = () => { const r = 1; originRef.current =")).toBe("function App() { const measureLayout = () => { const r = 1; originRef.current;}}");
  });

  test("ignores braces inside template expression strings", () => {
    expect(completePartialTsx('export default function App() { const label = `${"{"}`; return <div>Hi')).toBe('export default function App() { const label = `${"{"}`; return <div>Hi</div>;}');
  });

  test("keeps escaped characters inside string literals", () => {
    expect(completePartialTsx(String.raw`const label = "say \"hi\""`)).toBe(String.raw`const label = "say \"hi\""`);
  });

  test("ignores JSX-looking tags inside comments", () => {
    const completed = completePartialTsx("function App() { // <fake>\n return <div>Hi");
    expect(completed).not.toContain("</fake>");
    expect(completed).toContain("</div>");
  });

  test("closes unfinished block comments before completing the source", () => {
    expect(completePartialTsx("function App() { /* <fake>")).toBe("function App() { /* <fake>*/}");
  });

  test("keeps less-than comparisons inside JSX child expressions", () => {
    const code = "function App() { return <main><h1>Hi</h1><p>{count < total}</p></main>; }";
    expect(completePartialTsx(code)).toBe(code);
  });

  test("keeps slash-prefixed JSX text as text", () => {
    const code = "function App() { const total = 4; return <Text>/ {total}</Text>; }";
    expect(completePartialTsx(code)).toBe(code);
  });

  test("escapes raw less-than signs inside JSX text", () => {
    expect(completePartialTsx("function App() { return <Text>史上首次<30万</Text>; }")).toBe("function App() { return <Text>史上首次&lt;30万</Text>; }");
    expect(completePartialTsx("function App() { return <Text>x<y</Text>; }")).toBe("function App() { return <Text>x&lt;y</Text>; }");
    expect(completePartialTsx("function App() { return <Text>x < y and z</Text>; }")).toBe("function App() { return <Text>x &lt; y and z</Text>; }");
    expect(completePartialTsx("function App() { return <Text>低于 30 万</Text>; }")).toBe("function App() { return <Text>低于 30 万</Text>; }");
  });

  test("drops dangling raw less-than signs at the buffer end", () => {
    expect(completePartialTsx("function App() { return <div>Hello <")).toBe("function App() { return <div>Hello </div>;}");
  });

  test("closes arrow component JSX returns", () => {
    expect(completePartialTsx('const App = () => <div className="x"><h1>Hello')).toBe('const App = () => <div className="x"><h1>Hello</h1></div>');
  });

  test("fills an empty return expression with null as a separate token", () => {
    expect(completePartialTsx("function App() { return")).toBe("function App() { return null;}");
    expect(completePartialTsx("function App() { return (")).toBe("function App() { return (null);}");
  });

  test("fills an empty grouping or arrow-body paren with null but leaves empty argument lists alone", () => {
    expect(completePartialTsx("function App() { return <div>{items.map((")).toBe("function App() { return <div>{items.map((null))}</div>;}");
    expect(completePartialTsx("function App() { return <div>{items.map((x) => (")).toBe("function App() { return <div>{items.map((x) => (null))}</div>;}");
    expect(completePartialTsx("function App() { return <div>{fn(")).toBe("function App() { return <div>{fn()}</div>;}");
    expect(completePartialTsx("function App() { return <div>{fn?.(")).toBe("function App() { return <div>{fn?.()}</div>;}");
    expect(completePartialTsx("function App() { return <div>{obj.method?.(")).toBe("function App() { return <div>{obj.method?.()}</div>;}");
  });

  test("drops an incomplete PascalCase tag at the buffer end so it never throws ReferenceError mid-stream", () => {
    expect(completePartialTsx("function App() { return <div><Pi")).toBe("function App() { return <div></div>;}");
    expect(completePartialTsx("function App() { return <div><PillRow")).toBe("function App() { return <div></div>;}");
  });

  test("completes a streamed prop string and renders the PascalCase tag even with a closed quote at the buffer end", () => {
    expect(completePartialTsx('function App() { return <FeatureCard title="ok" description="123"')).toBe('function App() { return <FeatureCard title="ok" description="123"></FeatureCard>;}');
  });

  test("closes an unterminated prop string so the surrounding PascalCase tag stays renderable", () => {
    expect(completePartialTsx('function App() { return <FeatureCard title="ok" description="123')).toBe('function App() { return <FeatureCard title="ok" description="123"></FeatureCard>;}');
  });

  test("drops a dangling `prop=` but keeps the tag and earlier props (no `prop=>` for SWC to read as an arrow)", () => {
    expect(completePartialTsx("function App() { return <div><Grid columns={2} items=")).toBe("function App() { return <div><Grid columns={2}></Grid></div>;}");
  });

  test("strips empty JSX prop expressions from PascalCase tags too", () => {
    expect(completePartialTsx("function App() { return <Button onClick={")).toBe("function App() { return <Button></Button>;}");
  });

  test("strips the trailing streamed bare prop from incomplete PascalCase tags", () => {
    expect(completePartialTsx("function App() { return <RadialBarChart data")).toBe("function App() { return <RadialBarChart></RadialBarChart>;}");
    expect(completePartialTsx("function App() { return <RadialBarChart accessibilityLayer data")).toBe("function App() { return <RadialBarChart accessibilityLayer></RadialBarChart>;}");
    expect(completePartialTsx("function App() { return <RadialBarChart accessibilityLayer ")).toBe("function App() { return <RadialBarChart accessibilityLayer ></RadialBarChart>;}");
    expect(completePartialTsx("function App() { return <ChartContainer config={config}><RadialBarChart data")).toBe("function App() { return <ChartContainer config={config}><RadialBarChart></RadialBarChart></ChartContainer>;}");
  });

  test("strips a dangling `prop=` from lowercase host tags so they do not close as `prop=>` (SWC would parse `=>` as an arrow)", () => {
    expect(completePartialTsx("function App() { return <input data-foo=")).toBe("function App() { return <input />;}");
  });

  test("completes unterminated string attributes on host tags by synthesizing the closing quote", () => {
    expect(completePartialTsx('function App() { return <h1 title="hi')).toBe('function App() { return <h1 title="hi"></h1>;}');
    expect(completePartialTsx('function App() { return <div className="a b')).toBe('function App() { return <div className="a b"></div>;}');
    expect(completePartialTsx('function App() { return <input value="abc')).toBe('function App() { return <input value="abc" />;}');
  });

  // Unterminated attribute values are handled by value kind, not by host vs component: a string is safe to close (synthesize the quote), an expression is not (mid-stream `{x` may become `x.y`/`xyz`, so completing binds the wrong value) and is dropped whole.
  test("completes unterminated string values but drops unterminated expression values, on host and component alike", () => {
    expect(completePartialTsx('function App() { return <input value="ab')).toBe('function App() { return <input value="ab" />;}');
    expect(completePartialTsx('function App() { return <Card label="ab')).toBe('function App() { return <Card label="ab"></Card>;}');
    expect(completePartialTsx("function App() { return <input value={ab")).toBe("function App() { return <input />;}");
    expect(completePartialTsx("function App() { return <Card label={ab")).toBe("function App() { return <Card></Card>;}");
  });

  test("drops a backtick attribute value, which is illegal in JSX even when closed", () => {
    expect(completePartialTsx("function App() { return <div title=`hello")).toBe("function App() { return <div></div>;}");
    expect(completePartialTsx("function App() { return <div title=`hello ${x")).toBe("function App() { return <div></div>;}");
    expect(completePartialTsx("function App() { return <div className=`a` title=`b")).toBe("function App() { return <div></div>;}");
  });

  // A trailing odd backslash is an incomplete escape; the synthesized quote must not be swallowed by it (`title="foo\` → `title="foo\"` leaves the string open). Drop the dangling backslash, keep an even (already-escaped) one.
  test("drops a dangling backslash before synthesizing the closing quote", () => {
    expect(completePartialTsx('function App() { return <div title="foo\\')).toBe('function App() { return <div title="foo"></div>;}');
    expect(completePartialTsx(String.raw`function App() { return <div title="foo\\`)).toBe(String.raw`function App() { return <div title="foo\\"></div>;}`);
    expect(completePartialTsx(String.raw`function App() { return <div title="foo\n`)).toBe(String.raw`function App() { return <div title="foo\n"></div>;}`);
  });

  test("keeps the tag when a prop name is still streaming, on host and component tags alike", () => {
    expect(completePartialTsx("function App() { return <input valu")).toBe("function App() { return <input />;}");
    expect(completePartialTsx("function App() { return <input value=")).toBe("function App() { return <input />;}");
    expect(completePartialTsx("function App() { return <Input value=")).toBe("function App() { return <Input></Input>;}");
    // A trailing space commits the name as a boolean attribute instead of dropping it.
    expect(completePartialTsx("function App() { return <input hidden ")).toBe("function App() { return <input hidden  />;}");
    // Dropping a dangling `prop=` must not also drop a completed boolean attr before it.
    expect(completePartialTsx("function App() { return <input disabled value=")).toBe("function App() { return <input disabled />;}");
  });

  // The rendering safety invariant in one place: only string attribute values are completed (synthesize the quote), expression
  // values are never synthesized (any `{expr` may still grow a `?`/`.`/operator and become a different value, so a half-streamed
  // one would bind the wrong value or throw). A `{expr}` whose `}` has already streamed is committed by the model and kept as-is.
  test("attribute completion: synthesize only string values, drop unterminated expressions, keep closed ones", () => {
    // `<A b` — name still streaming (`b` may become `bar`), so it is dropped entirely.
    expect(completePartialTsx("function App() { return <A b")).toBe("function App() { return <A></A>;}");
    // `<A b ` — the trailing space commits `b` as a boolean attribute.
    expect(completePartialTsx("function App() { return <A b ")).toBe("function App() { return <A b ></A>;}");
    // A closed `{expr}` is kept verbatim, even a comparison the ternary-prefix worry would otherwise flag.
    expect(completePartialTsx("function App() { return <Card foo={bar}")).toBe("function App() { return <Card foo={bar}></Card>;}");
    expect(completePartialTsx("function App() { return <Card foo={count > 1}")).toBe("function App() { return <Card foo={count > 1}></Card>;}");
    // A closed `{expr}` is kept while the next attribute name is still streaming and gets dropped.
    expect(completePartialTsx("function App() { return <Card foo={bar} baz")).toBe("function App() { return <Card foo={bar}></Card>;}");
    // A closed `{expr}` survives a dangling `name=` after it.
    expect(completePartialTsx("function App() { return <Card foo={bar} baz=")).toBe("function App() { return <Card foo={bar}></Card>;}");
    // A closed `{expr}` survives a later unterminated string value, which is completed by synthesizing the quote.
    expect(completePartialTsx('function App() { return <Card foo={bar} title="ok')).toBe('function App() { return <Card foo={bar} title="ok"></Card>;}');
  });

  test("defers a host tag whose name ends at the buffer, same as a component (`sp` may still become `span`)", () => {
    expect(completePartialTsx("function App() { return <div><sp")).toBe("function App() { return <div></div>;}");
  });

  test("defers every host frame until a separator commits the name, then completes as a void element", () => {
    for (const partial of ["<", "<i", "<in", "<inp", "<inpu", "<input"]) expect(completePartialTsx(`function App() { return <div>${partial}`)).toBe("function App() { return <div></div>;}");
    expect(completePartialTsx("function App() { return <div><input ")).toBe("function App() { return <div><input  /></div>;}");
    expect(completePartialTsx("function App() { return <div><input>")).toBe("function App() { return <div><input /></div>;}");
  });

  test("closes JSX fragments", () => {
    expect(completePartialTsx("function App() { return <><div>a</div><span>b")).toBe("function App() { return <><div>a</div><span>b</span></>;}");
  });

  test("closes JSX child expressions before parent tags", () => {
    expect(completePartialTsx("function App() { return <div>{count")).toBe("function App() { return <div>{count}</div>;}");
  });

  test("drops trailing incomplete JSX child expression operators", () => {
    expect(completePartialTsx("function App() { return <div>{count <")).toBe("function App() { return <div>{count}</div>;}");
    expect(completePartialTsx("function App() { return <div>{count <=")).toBe("function App() { return <div>{count}</div>;}");
    expect(completePartialTsx("function App() { return <div>{count >")).toBe("function App() { return <div>{count}</div>;}");
    expect(completePartialTsx("function App() { return <div>{count >=")).toBe("function App() { return <div>{count}</div>;}");
    expect(completePartialTsx("function App() { return <div>{count ===")).toBe("function App() { return <div>{count}</div>;}");
    expect(completePartialTsx("function App() { return <div>{count !==")).toBe("function App() { return <div>{count}</div>;}");
    expect(completePartialTsx("function App() { return <div>{count ??")).toBe("function App() { return <div>{count}</div>;}");
    expect(completePartialTsx("function App() { return <div>{user?.")).toBe("function App() { return <div>{user}</div>;}");
    expect(completePartialTsx("function App() { return <div>{count **")).toBe("function App() { return <div>{count}</div>;}");
    expect(completePartialTsx("function App() { return <div>{count ?")).toBe("function App() { return <div>{count ? null : null}</div>;}");
    expect(completePartialTsx("function App() { return <div>{count ? label")).toBe("function App() { return <div>{count ? label : null}</div>;}");
  });

  test("drops a trailing member-access dot but keeps decimal points and spreads", () => {
    expect(completePartialTsx("function App(){return <>{[1].")).toBe("function App(){return <>{[1]}</>;}");
    expect(completePartialTsx("function App(){return <>{x.y.")).toBe("function App(){return <>{x.y}</>;}");
    expect(completePartialTsx("function App(){return <>{[...arr].")).toBe("function App(){return <>{[...arr]}</>;}");
    expect(completePartialTsx("function App(){return <>{0.5")).toBe("function App(){return <>{0.5}</>;}");
  });

  test("drops trailing incomplete JSX child compound assignment operators", () => {
    for (const operator of ["+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "&&=", "||=", "??=", "**=", "<<=", ">>=", ">>>="]) {
      expect(completePartialTsx(`function App() { return <div>{count ${operator}`)).toBe("function App() { return <div>{count}</div>;}");
    }
  });

  test("does not complete question marks inside literals as ternaries", () => {
    expect(completePartialTsx('const label = "Ready?"')).toBe('const label = "Ready?"');
    expect(completePartialTsx('function App() { return "Ready?"')).toBe('function App() { return "Ready?";}');
    expect(completePartialTsx('function App() { return <div>{"Ready?"')).toBe('function App() { return <div>{"Ready?"}</div>;}');
    // An unterminated prop expression is dropped whole (the value kind is `{}`, not a string attribute).
    expect(completePartialTsx('function App() { return <Card label={"Ready?"')).toBe("function App() { return <Card></Card>;}");
  });

  test("drops streamed arrow operators atomically", () => {
    expect(completePartialTsx("function App() { return <div>{() =>")).toBe("function App() { return <div>{() => null}</div>;}");
    expect(completePartialTsx("function App() { return <div>{items.map(item =>")).toBe("function App() { return <div>{items.map(item => null)}</div>;}");
    expect(completePartialTsx("function App() { return items.map(item =>")).toBe("function App() { return items.map(item => null);}");
    // An unterminated prop expression is dropped whole rather than completed.
    expect(completePartialTsx("function App() { return <Card foo={items.map(item =>")).toBe("function App() { return <Card></Card>;}");
  });

  test("keeps complete regex literals in JSX child expressions", () => {
    expect(completePartialTsx("function App() { return <div>{/foo/")).toBe("function App() { return <div>{/foo/}</div>;}");
  });

  test("drops an unterminated prop expression whole, keeping the tag and earlier props", () => {
    expect(completePartialTsx("function App() { return <input value={count")).toBe("function App() { return <input />;}");
    expect(completePartialTsx("function App() { return <input value={count.")).toBe("function App() { return <input />;}");
    expect(completePartialTsx("function App() { return <div {...props")).toBe("function App() { return <div ></div>;}");
    expect(completePartialTsx("function App() { return <Foo bar={x +")).toBe("function App() { return <Foo></Foo>;}");
    expect(completePartialTsx("function App() { return <Foo bar={x ?")).toBe("function App() { return <Foo></Foo>;}");
    expect(completePartialTsx("function App() { return <Card foo={user?.")).toBe("function App() { return <Card></Card>;}");
    expect(completePartialTsx("function App() { return <Card data={const x =")).toBe("function App() { return <Card></Card>;}");
  });

  test("keeps self-closing JSX tags whose prop expressions contain operator tokens", () => {
    expect(completePartialTsx("function App() { return <Card foo={() => null} />")).toBe("function App() { return <Card foo={() => null} />;}");
    expect(completePartialTsx("function App() { return <Card foo={count > 1} />")).toBe("function App() { return <Card foo={count > 1} />;}");
    expect(completePartialTsx('function App() { return <Card foo={label.endsWith(">")} />')).toBe('function App() { return <Card foo={label.endsWith(">")} />;}');
  });

  test("drops trailing incomplete non-JSX comparison operators before closing statements", () => {
    expect(completePartialTsx("function App() { return count <")).toBe("function App() { return count ;}");
    expect(completePartialTsx("function App() { return count <=")).toBe("function App() { return count;}");
    expect(completePartialTsx("function App() { if (count <")).toBe("function App() { if (count );}");
    expect(completePartialTsx("function App() { if (count <=")).toBe("function App() { if (count);}");
    expect(completePartialTsx("function App() { return count ??")).toBe("function App() { return count;}");
    expect(completePartialTsx("function App() { return count ?")).toBe("function App() { return count ? null : null;}");
    expect(completePartialTsx("function App() { return count /")).toBe("function App() { return count;}");
    expect(completePartialTsx("function App() { return count >>")).toBe("function App() { return count;}");
    expect(completePartialTsx('function App() { return a <b && c === ">" >')).toBe('function App() { return a <b && c === ">";}');
    expect(completePartialTsx("function App() { return count ~")).toBe("function App() { return count;}");
    expect(completePartialTsx("function App() { return user?.")).toBe("function App() { return user;}");
    expect(completePartialTsx("function App() { return count **")).toBe("function App() { return count;}");
    expect(completePartialTsx("const x =")).toBe("");
  });

  test("completes void host tags as self-closing even after the closing bracket streams", () => {
    expect(completePartialTsx("function App() { return <input>")).toBe("function App() { return <input />;}");
    expect(completePartialTsx('function App() { return <input value="x">')).toBe('function App() { return <input value="x" />;}');
  });

  test("drops explicit void host closing tags after self-closing the opener", () => {
    expect(completePartialTsx("function App() { return <div><input></input></div>")).toBe("function App() { return <div><input /></div>;}");
  });

  test("ignores braces inside regex literals", () => {
    expect(completePartialTsx("function App() { const re = /{/; return <div>Hi")).toBe("function App() { const re = /{/; return <div>Hi</div>;}");
  });

  test("ignores JSX-looking tags inside regex literals", () => {
    const completed = completePartialTsx("function App() { const re = /<fake>/; return <div>Hi");
    expect(completed).not.toContain("</fake>");
    expect(completed).toContain("</div>");
  });

  test("keeps regex literals after less-than operators", () => {
    expect(completePartialTsx("function App() { const ok = value</<fake>/; return <div>Hi")).toBe("function App() { const ok = value</<fake>/; return <div>Hi</div>;}");
  });

  describe("drops unterminated JSX prop expressions", () => {
    test("drops an unterminated nested-JSX prop expression whole", () => {
      expect(completePartialTsx("function App() { return <Card header={<Badge><span>Live")).toBe("function App() { return <Card></Card>;}");
    });

    test("keeps an earlier completed JSX prop and drops a later unterminated one", () => {
      expect(completePartialTsx("function App() { return <Card header={<Badge><span>Live</span></Badge>} footer={<Button>More")).toBe("function App() { return <Card header={<Badge><span>Live</span></Badge>}></Card>;}");
    });

    test("drops an unterminated concatenated string expression whole", () => {
      expect(completePartialTsx('function App() { return <Card title={"Hello " + (name ?? "guest")')).toBe("function App() { return <Card></Card>;}");
    });

    test("drops an unterminated template string expression whole", () => {
      expect(completePartialTsx('function App() { return <Card title={`Hello ${name ?? "guest"}`')).toBe("function App() { return <Card></Card>;}");
    });

    test("drops a dangling second function declaration while its keyword and name stream in", () => {
      expect(completePartialTsx("function Helper(){return <b>hi</b>}\nfunction")).toBe("function Helper(){return <b>hi</b>}\n");
      expect(completePartialTsx("function Helper(){return <b>hi</b>}\nfunction App")).toBe("function Helper(){return <b>hi</b>}\n");
      expect(completePartialTsx("function Helper(){return <b>hi</b>}\nexport function")).toBe("function Helper(){return <b>hi</b>}\n");
      expect(completePartialTsx("function Helper(){return <b>hi</b>}\nexport function App")).toBe("function Helper(){return <b>hi</b>}\n");
      expect(completePartialTsx("function Helper(){return <b>hi</b>}\nasync function App")).toBe("function Helper(){return <b>hi</b>}\n");
      expect(completePartialTsx("function Helper(){return <b>hi</b>}\nexport default async function App")).toBe("function Helper(){return <b>hi</b>}\n");
    });
  });

  describe("does not treat TSX generic type-param lists as JSX", () => {
    test("keeps a complete generic arrow without appending a closing tag", () => {
      expect(completePartialTsx("function App(){const id=<T,>(x:T)=>x;return <div>{String(id(1))}</div>}")).toBe("function App(){const id=<T,>(x:T)=>x;return <div>{String(id(1))}</div>}");
    });

    test("does not open a JSX frame on a streaming generic-arrow prefix", () => {
      expect(completePartialTsx("function App(){const id=<T,")).toBe("function App(){const id=<T,}");
    });
  });
});

describe("normalizeGeneratedTsx", () => {
  test("infers a default export from a named component", () => {
    expect(normalizeGeneratedTsx("function Card() { return <div />; }")).toContain("export default Card;");
  });

  test("strips markdown fences before completion", () => {
    expect(normalizeGeneratedTsx("```tsx\nfunction Card() { return <div>Hi\n```")).toBe("function Card() { return <div>Hi</div>;}\nexport default Card;");
    expect(normalizeGeneratedTsx('```tsx filename="App.tsx"\nfunction App(){return <div>ok</div>}\n```')).toBe("function App(){return <div>ok</div>}\nexport default App;");
  });

  test("does not treat JSX text as an existing default export", () => {
    expect(normalizeGeneratedTsx("function Card() { return <p>export default</p>; }")).toContain("export default Card;");
  });

  test("does not treat a declaration inside a nested template substitution as an exportable component", () => {
    expect(normalizeGeneratedTsx("function App(){const s=`${`function Ghost(){}`}`;return <div>ok</div>}")).toContain("export default App;");
    expect(normalizeGeneratedTsx("function App(){const s=`${`function Ghost(){}`}`;return <div>ok</div>}")).not.toContain("export default Ghost;");
    expect(normalizeGeneratedTsx("const s = `${/{/.test(x)}`; function App(){return <div/>}")).toContain("export default App;");
    expect(normalizeGeneratedTsx("const s = `${/* { */ x}`; function App(){return <div/>}")).toContain("export default App;");
  });

  test("does not treat comments as existing default exports", () => {
    const normalized = normalizeGeneratedTsx("/*\nexport default function Fake(){}\n*/\nfunction Card() { return <p />; }");
    expect(normalized).toContain("export default Card;");
  });

  test("does not infer export names from comments", () => {
    const normalized = normalizeGeneratedTsx("function Card() { return <p />; }\n// function Ghost() {}");
    expect(normalized).toContain("export default Card;");
    expect(normalized).not.toContain("export default Ghost;");
  });

  test("does not infer export names from literals", () => {
    const normalized = normalizeGeneratedTsx('function Card() { return <p />; }\nconst note = "function Ghost(){}";\nconst template = `const Phantom = () => null`;\nconst pattern = /function RegexGhost\\(\\)/;');
    expect(normalized).toContain("export default Card;");
    expect(normalized).not.toContain("export default Ghost;");
    expect(normalized).not.toContain("export default Phantom;");
    expect(normalized).not.toContain("export default RegexGhost;");
  });

  test("does not infer export names from regex literals after less-than operators", () => {
    const normalized = normalizeGeneratedTsx("function Card() { return <p />; }\nconst ok = value</function Ghost()/;");
    expect(normalized).toContain("export default Card;");
    expect(normalized).not.toContain("export default Ghost;");
  });

  test("infers async arrow components", () => {
    expect(normalizeGeneratedTsx("const Card = async () => <p />;")).toContain("export default Card;");
  });

  test("infers typed arrow components", () => {
    expect(normalizeGeneratedTsx("const Card: React.FC = () => <p />;")).toContain("export default Card;");
  });

  test("infers class components", () => {
    expect(normalizeGeneratedTsx("class Card extends React.Component { render() { return <p />; } }")).toContain("export default Card;");
  });

  test("does not infer helper classes as React components", () => {
    expect(normalizeGeneratedTsx("function Card() { return <p />; }\nclass ThemeToken {}")).toContain("export default Card;");
  });

  test("infers wrapped component factories", () => {
    expect(normalizeGeneratedTsx("const Card = memo(function CardImpl() { return <p />; });")).toContain("export default Card;");
    expect(normalizeGeneratedTsx("const Field = forwardRef((props, ref) => <input ref={ref} />);")).toContain("export default Field;");
  });

  test("infers typed wrapped component factories", () => {
    expect(normalizeGeneratedTsx("const App = memo<{x:number}>(() => <div>ok</div>)")).toContain("export default App;");
    expect(normalizeGeneratedTsx("const App = memo<Props<Foo>>(() => <div>ok</div>)")).toContain("export default App;");
    expect(normalizeGeneratedTsx("const App = memo<() => JSX.Element>(function Inner() { return <div>ok</div>; })")).toContain("export default App;");
    expect(normalizeGeneratedTsx("const Field = forwardRef<HTMLDivElement>((props, ref) => <div ref={ref} />)")).toContain("export default Field;");
    const normalized = normalizeGeneratedTsx("const App = React.memo<ComponentProps<typeof Button>>(function Inner() { return <div>ok</div>; })");
    expect(normalized).toContain("export default App;");
    expect(normalized).not.toContain("export default Inner;");
  });

  test("keeps default JSX exports without appending another one", () => {
    const normalized = normalizeGeneratedTsx('const Card = () => <p />;\nexport default <Card className="x" />;');
    expect(normalized.match(/(?:^|\n)\s*export\s+default/g)?.length).toBe(1);
  });

  test("keeps real default exports without appending another one", () => {
    const normalized = normalizeGeneratedTsx("export default function Card() { return <p>export default</p>; }");
    expect(normalized.match(/(?:^|\n)\s*export\s+default/g)?.length).toBe(1);
  });

  test("keeps a same-line default export after a semicolon or block close without appending another one", () => {
    expect(normalizeGeneratedTsx(";export default function App(){return <div>ok</div>}")).toBe(";export default function App(){return <div>ok</div>}");
    expect(normalizeGeneratedTsx("const x=1;export default function App(){return <div/>}")).toBe("const x=1;export default function App(){return <div/>}");
    expect(normalizeGeneratedTsx("if(true){} export default function App(){return <div/>}")).toBe("if(true){} export default function App(){return <div/>}");
  });

  test("keeps real default exports after helper components with closing JSX tags", () => {
    const normalized = normalizeGeneratedTsx("function BadgeFront() { return <div><span>Front</span></div>; }\nfunction BadgeBack() { return <div>Back</div>; }\nexport default function App() { return <BadgeFront />; }");
    expect(normalized.match(/(?:^|\n)\s*export\s+default/g)?.length).toBe(1);
    expect(normalized).not.toContain("export default BadgeFront;");
  });

  test("keeps re-exported defaults without appending another one", () => {
    expect(normalizeGeneratedTsx("function Card() { return <p />; }\nexport { Card as default };")).toBe("function Card() { return <p />; }\nexport { Card as default };");
  });

  describe("missing react hook imports", () => {
    test("adds a new react import when none exists", () => {
      const normalized = normalizeGeneratedTsx("function App() { const [n, setN] = useState(0); return <p>{n}</p>; }");
      expect(normalized.startsWith('import { useState } from "react";')).toBe(true);
    });

    test("merges missing hooks into an existing react named import", () => {
      const normalized = normalizeGeneratedTsx('import { useState } from "react";\nfunction App() { const r = useRef(null); const [n] = useState(0); return <p ref={r}>{n}</p>; }');
      expect(normalized).toContain('import { useState, useRef } from "react"');
      expect(normalized.match(/from\s+"react"/g)?.length).toBe(1);
    });

    test("recognizes react hook imports after a same-line semicolon", () => {
      const normalized = normalizeGeneratedTsx(';import { useState } from "react";\nfunction App(){const [x]=useState(1);return <div>{x}</div>}');
      expect(normalized).toBe(';import { useState } from "react";\nfunction App(){const [x]=useState(1);return <div>{x}</div>}\nexport default App;');
    });

    test("merges missing hooks into react imports after a same-line semicolon", () => {
      const normalized = normalizeGeneratedTsx(';import { useState } from "react";\nfunction App(){const [x]=useState(1); const r = useRef(null); return <div ref={r}>{x}</div>}');
      expect(normalized).toContain(';import { useState, useRef } from "react"');
      expect(normalized.match(/from\s+"react"/g)?.length).toBe(1);
    });

    test("does not duplicate hooks already imported via alias", () => {
      const normalized = normalizeGeneratedTsx('import { useState as useS } from "react";\nfunction App() { const [n] = useS(0); return <p>{n}</p>; }');
      expect(normalized).toBe('import { useState as useS } from "react";\nfunction App() { const [n] = useS(0); return <p>{n}</p>; }\nexport default App;');
    });

    test("does not touch hooks imported from a namespace import", () => {
      const normalized = normalizeGeneratedTsx('import * as React from "react";\nfunction App() { const [n] = React.useState(0); return <p>{n}</p>; }');
      expect(normalized).not.toContain("import { useState }");
    });

    test("does not touch hooks accessed via a default react import", () => {
      const normalized = normalizeGeneratedTsx('import React from "react";\nfunction App() { const [n] = React.useState(0); return <p>{n}</p>; }');
      expect(normalized).not.toContain("import { useState }");
    });

    test("ignores hook-looking calls inside strings and comments", () => {
      const normalized = normalizeGeneratedTsx('function App() { /* useEffect */ const note = "useState"; return <p>{note}</p>; }');
      expect(normalized).not.toContain('from "react"');
    });

    test("does not merge hooks into import-shaped comments or strings", () => {
      const comment = normalizeGeneratedTsx('// import { useState } from "react";\nfunction App(){const [x]=useState(1);return <div>{x}</div>}');
      expect(comment).toBe('import { useState } from "react";\n// import { useState } from "react";\nfunction App(){const [x]=useState(1);return <div>{x}</div>}\nexport default App;');
      const literal = normalizeGeneratedTsx('const s="import { useState } from \\"react\\";";\nfunction App(){const [x]=useState(1);return <div>{x}</div>}');
      expect(literal).toBe('import { useState } from "react";\nconst s="import { useState } from \\"react\\";";\nfunction App(){const [x]=useState(1);return <div>{x}</div>}\nexport default App;');
    });

    test("does not treat semicolon-prefixed imports inside literals as real imports", () => {
      const normalized = normalizeGeneratedTsx('const s=";import { useState } from \\"react\\";";\nfunction App(){const [x]=useState(1);return <div>{x}</div>}');
      expect(normalized).toBe('import { useState } from "react";\nconst s=";import { useState } from \\"react\\";";\nfunction App(){const [x]=useState(1);return <div>{x}</div>}\nexport default App;');
    });

    test("ignores custom hooks outside the react whitelist", () => {
      const normalized = normalizeGeneratedTsx('import { useCustomThing } from "./hooks";\nfunction App() { const v = useCustomThing(); return <p>{v}</p>; }');
      expect(normalized).not.toContain('from "react"');
    });

    test("merges into mixed default+named react imports without duplicating the import", () => {
      const normalized = normalizeGeneratedTsx('import React, { useState } from "react";\nfunction App() { const r = useRef(null); const [n] = useState(0); return <p ref={r}>{n}</p>; }');
      expect(normalized).toContain('import React, { useState, useRef } from "react"');
      expect(normalized.match(/from\s+"react"/g)?.length).toBe(1);
    });

    test("does not merge value hooks into a type-only react import", () => {
      const normalized = normalizeGeneratedTsx('import type { FC } from "react";\nfunction App() { const [n] = useState(0); return <p>{n}</p>; }');
      expect(normalized).toContain('import type { FC } from "react"');
      expect(normalized).toContain('import { useState } from "react"');
    });
  });
});
