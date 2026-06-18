import { describe, expect, test } from "bun:test";
import { getGenUIHookSignature } from "./hookSignature";

const HOOK_SIGNATURE_CASES: Array<[string, string, string]> = [
  ["ignores hook-looking tokens in comments and strings", "function App(){ const note = 'useState('; /* useRef( */ const [n] = React.useState(0); useEffect(() => {}, []); }", "useState\nuseEffect"],
  ["ignores member calls on non-React objects", "function App(){ model.useState(); useRef(null); }", "useRef"],
  ["extracts hooks inside template expressions", "function App(){ const c = `w-${useToken()}`; const [t]=useState(0); }", "useToken\nuseState"],
  ["extracts hooks inside JSX expressions", "function App(){ return <p>I'm {useMemo(()=>1,[])} you're cool</p>; useState(); }", "useMemo\nuseState"],
  ["ignores hook-looking regex text", "function App(){ const re = /I'm you're/; useState(); }", "useState"],
  ["extracts generic hook calls", "function App(){ const ref = useRef<HTMLDivElement>(null); const [value] = useState<string | null>(null); return useMemo(() => value, [value]); }", "useRef\nuseState\nuseMemo"],
  ["extracts imported React namespace hook calls", 'import * as R from "react"; import react from "react"; function App(){ R.useState(0); react.useEffect(() => {}, []); React?.useMemo(() => 1, []); }', "useState\nuseEffect\nuseMemo"],
  ["normalizes direct custom hook calls", "function useFoo(){ return useState(0); } function App(){ service . useState(); model.useEffect(); useFoo(); }", "useState\nuseCustomHook"],
  ["ignores namespace methods on non-React imports", 'import NumberFlow from "@number-flow/react";\nimport { useState } from "react";\nfunction App(){ NumberFlow.useState(); useState(0); }', "useState"],
];

describe("getGenUIHookSignature", () => {
  test.each(HOOK_SIGNATURE_CASES)("%s", (_name, code, expected) => {
    expect(getGenUIHookSignature(code)).toBe(expected);
  });

  test("normalizes custom hook names", () => {
    expect(getGenUIHookSignature("function useFoo(){ return useState(0); } function App(){ useFoo(); }")).toBe(getGenUIHookSignature("function useGadget(){ return useState(0); } function App(){ useGadget(); }"));
  });
});
