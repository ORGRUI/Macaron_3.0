import { describe, expect, test } from "bun:test";
import { appendImportMetaSearchParams, genUIImportMapPlugin, toGenUIChunkName } from "./vite";

describe("toGenUIChunkName", () => {
  test("produces filename-safe, collision-free chunk names for every specifier shape", () => {
    expect(toGenUIChunkName("react")).toBe("genui-react");
    expect(toGenUIChunkName("$macaron/ui/katex")).toBe("genui-macaron-ui-katex");
    expect(toGenUIChunkName("@/components/ui/avatar")).toBe("genui-src-components-ui-avatar");
    expect(toGenUIChunkName("input-otp")).toBe("genui-input-otp");
    expect(/^[A-Za-z0-9_-]+$/.test(toGenUIChunkName("@/components/ui/input-otp"))).toBe(true);
  });
});

describe("appendImportMetaSearchParams", () => {
  test("appends importer params it lacks, but never overwrites its own", () => {
    expect(appendImportMetaSearchParams("genui-react.abc.js", "https://genui-v1-demo.macaron.im/_astro/importmap.js?dpl=dpl_123")).toBe("https://genui-v1-demo.macaron.im/_astro/genui-react.abc.js?dpl=dpl_123");
    expect(appendImportMetaSearchParams("genui-react.abc.js?cache=1", "https://genui-v1-demo.macaron.im/_astro/importmap.js?dpl=dpl_123&cache=2")).toBe("https://genui-v1-demo.macaron.im/_astro/genui-react.abc.js?cache=1&dpl=dpl_123");
  });

  test("keeps core GenUI runtime and component-library entries on the same deployment query", () => {
    const importMetaUrl = "https://genui-v1-demo.macaron.im/_astro/importmap.js?dpl=dpl_123";
    const entries = {
      react: appendImportMetaSearchParams("genui-react.abc.js", importMetaUrl),
      "react/jsx-runtime": appendImportMetaSearchParams("genui-react-jsx-runtime.def.js", importMetaUrl),
      "$macaron/ui": appendImportMetaSearchParams("genui-macaron-ui.ghi.js", importMetaUrl),
      "@/macaron/source": appendImportMetaSearchParams("genui-src-macaron-source.jkl.js", importMetaUrl),
    };
    expect(Object.values(entries).every((target) => new URL(target).searchParams.get("dpl") === "dpl_123")).toBe(true);
  });
});

describe("genUIImportMapPlugin", () => {
  // load()'s build branch emits the browser-side helper (derived from the same importMetaSearchParamsBody as appendImportMetaSearchParams) and
  // must wrap each ROLLUP_FILE_URL with it; drop the wrapping and dpl skew protection silently breaks in prod only.
  test("wraps emitted build URLs with the import-meta-search helper", () => {
    const plugin = genUIImportMapPlugin({ imports: { react: "/src/lib/react.ts", "react/jsx-runtime": "/src/lib/react-jsx-runtime.ts", "$macaron/ui": "/src/genui/macaron.tsx", "@/macaron/source": "/src/macaron/source.tsx" }, moduleId: "virtual:genui-importmap" });
    plugin.config({}, { command: "build" });
    plugin.buildStart.call({ emitFile: (file) => `${file.name}-ref` });
    const code = plugin.load("\0virtual:genui-importmap");
    expect(code).toContain("const withImportMetaSearch = (target) =>");
    expect(code).toContain('"react": withImportMetaSearch(import.meta.ROLLUP_FILE_URL_genui-react-ref)');
    expect(code).toContain('"react/jsx-runtime": withImportMetaSearch(import.meta.ROLLUP_FILE_URL_genui-react-jsx-runtime-ref)');
    expect(code).toContain('"$macaron/ui": withImportMetaSearch(import.meta.ROLLUP_FILE_URL_genui-macaron-ui-ref)');
    expect(code).toContain('"@/macaron/source": withImportMetaSearch(import.meta.ROLLUP_FILE_URL_genui-src-macaron-source-ref)');
  });
});
