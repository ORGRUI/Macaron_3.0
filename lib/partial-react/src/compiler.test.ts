import { describe, expect, test } from "bun:test";
import { createTsxCompiler } from "./compiler";
import { normalizeGeneratedTsx } from "partial-tsx";

const importMap = { imports: { react: "/src/lib/react.ts", "react/jsx-runtime": "/src/lib/react-jsx-runtime.ts", "react/jsx-dev-runtime": "/src/lib/react-jsx-dev-runtime.ts", macaron: "/src/genui/macaron.tsx", charts: "/src/genui/charts.tsx" } };
const engineDebugSample = `import { useState } from "react";
import { Button } from "macaron";

function EngineProbe() {
  const [text, setText] = useState("kept-state");
  return (
    <div className="p-5 font-sans space-y-3">
      <div className="text-xs uppercase tracking-[0.18em] text-orange-600">engine probe</div>
      <label className="block text-sm font-medium text-gray-700">Preserved label</label>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="state probe"
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-orange-500"
      />
      <Button type="button" className="rounded-md px-3 py-1.5 text-sm">Local facade works</Button>
    </div>
  );
}`;

describe("createTsxCompiler", () => {
  test("compiles complete TSX to ESM with import-map rewritten specifiers", async () => {
    const compiler = createTsxCompiler();
    const result = await compiler.compile('import { Button } from "macaron"; export default function App() { return <Button>Hi</Button>; }', { importMap });
    expect(result.code).toContain('from "/src/lib/react-jsx-runtime.ts"');
    expect(result.code).toContain('from "/src/genui/macaron.tsx"');
    expect(result.code).toContain("export default function App");
  });

  test("normalizes partial TSX before compiling", async () => {
    const compiler = createTsxCompiler();
    const result = await compiler.compile("function App() { return <div>Loading", { importMap, partial: true });
    expect(result.code).toContain("export default App");
    expect(result.code).toContain("Loading");
  });

  test("compiles the normalized output used by engine debug", async () => {
    const compiler = createTsxCompiler();
    const normalized = normalizeGeneratedTsx('import { useState } from "react"; function App() { const [text, setText] = useState("x"); return <div><input value={text} onChange={(event) => setText(event.target.value)} className="w-full rounded-md bord');
    const result = await compiler.compile(normalized, { importMap });
    expect(result.code).toContain("export default App");
    expect(result.code).toContain("/src/lib/react-jsx-runtime.ts");
  });

  test("compiles normalized parenthesized JSX after dropping an incomplete tag", async () => {
    const compiler = createTsxCompiler();
    const normalized = normalizeGeneratedTsx('import { useState } from "react"; function EngineProbe() { const [text, setText] = useState("x"); return (<div><label>Ready</label><input value={text} onChange={(event) => setText(event.target.value)} className="w-full rounded-md bord');
    const result = await compiler.compile(normalized, { importMap });
    expect(result.code).toContain("export default EngineProbe");
    expect(result.code).toContain("Ready");
  });

  test("compiles raw numeric less-than text after normalization", async () => {
    const compiler = createTsxCompiler();
    const normalized = normalizeGeneratedTsx("function App() { return <Text>史上首次<30万</Text>; }");
    expect(normalized).toContain("史上首次&lt;30万");
    const result = await compiler.compile(normalized, { importMap });
    expect(result.code).toContain("export default App");
  });

  test("does not compile a streamed Recharts data prop prefix as boolean data", async () => {
    const compiler = createTsxCompiler();
    const result = await compiler.compile('import { ChartContainer, RadialBarChart, type ChartConfig } from "charts"; const config = {} satisfies ChartConfig; export default function App() { return <ChartContainer config={config}><RadialBarChart data', { importMap, partial: true });
    expect(result.source).toContain("<RadialBarChart></RadialBarChart>");
    expect(result.source).not.toContain("<RadialBarChart data>");
  });

  test("deduplicates byte-identical output", async () => {
    const compiler = createTsxCompiler();
    const first = await compiler.compile("export default function App() { return <div>A</div>; }", { importMap });
    const second = await compiler.compile("export default function App() { return <div>A</div>; }", { importMap, previousCode: first.code });
    expect(second.changed).toBe(false);
  });

  test("keeps engine debug renderable prefixes compilable once they become renderable", async () => {
    const compiler = createTsxCompiler();
    let seenRenderable = false;
    let previousOk = false;
    const regressions: Array<{ index: number; error: string; context: string }> = [];
    const compiled = new Set<string>();
    for (let index = 1; index <= engineDebugSample.length; index += 1) {
      const prefix = engineDebugSample.slice(0, index);
      const normalized = normalizeGeneratedTsx(prefix);
      if (compiled.has(normalized)) continue;
      compiled.add(normalized);
      const renderable = normalized.includes("export default EngineProbe;");
      if (!renderable) continue;
      let ok = true;
      let error = "";
      try {
        await compiler.compile(normalized, { importMap });
      } catch (caught) {
        ok = false;
        error = caught instanceof Error ? caught.message : String(caught);
      }
      if (seenRenderable && previousOk && !ok) regressions.push({ index, error, context: engineDebugSample.slice(Math.max(0, index - 24), Math.min(engineDebugSample.length, index + 24)) });
      seenRenderable = true;
      previousOk = ok;
    }
    expect(regressions).toEqual([]);
  });
});
