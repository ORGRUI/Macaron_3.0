import { describe, expect, test } from "bun:test";
import { createImportMapResolver, esmShFallback, extractBareModuleSpecifiers, literalImportMap, mergeFallbackImports, prepareRendererImportMap, toEsmShImportUrl, urlImportMap } from "./importMap";

describe("extractBareModuleSpecifiers", () => {
  test("extracts static and dynamic bare imports", () => {
    expect([...extractBareModuleSpecifiers('import x from "macaron"; export { y } from "@/foo"; await import("lucide-react"); import("./local")')]).toEqual(["macaron", "@/foo", "lucide-react"]);
  });

  test("ignores import-looking text inside comments and strings", () => {
    const code = ['// import x from "comment-only";', '/* export { y } from "block-only"; */', "const label = \"import fake from 'string-only'\";", 'const template = `await import("template-only")`;', 'import React from "react";', 'export { Icon } from "lucide-react";', 'await import("@scope/pkg");'].join("\n");
    expect([...extractBareModuleSpecifiers(code)]).toEqual(["react", "lucide-react", "@scope/pkg"]);
  });

  test("extracts dynamic imports inside template expressions but not template text", () => {
    const code = 'const markup = `raw import("raw-only") ${await import("framer-motion")}`; import React from "react";';
    expect([...extractBareModuleSpecifiers(code)]).toEqual(["framer-motion", "react"]);
  });

  test("extracts re-exports with bindings named from", () => {
    expect([...extractBareModuleSpecifiers('export { x as from } from "real";')]).toEqual(["real"]);
  });

  test("ignores import-looking text inside regex literals", () => {
    const code = 'const fakeImport = /import("fake")/; const fakeExport = /export { x } from "also-fake"/; import React from "react";';
    expect([...extractBareModuleSpecifiers(code)]).toEqual(["react"]);
  });

  test("skips local export declarations before scanning re-export specifiers", () => {
    const code = 'export const label = "from fake"; export async function load() {} export default function App() { return null; } export { Icon } from "lucide-react";';
    expect([...extractBareModuleSpecifiers(code)]).toEqual(["lucide-react"]);
  });
});

describe("prepareRendererImportMap", () => {
  test("keeps explicit entries and normalizes relative URLs", () => {
    expect(prepareRendererImportMap({ imports: { react: "/src/lib/react.ts", macaron: "./facade.js" } }, "https://example.test/debug").imports).toEqual({ react: "https://example.test/src/lib/react.ts", macaron: "https://example.test/facade.js" });
  });

  test("does not bake localhost into SSR import-map targets", () => {
    expect(prepareRendererImportMap({ imports: { react: "/_astro/genui-react.abc123.js" } }).imports.react).toBe("/_astro/genui-react.abc123.js");
  });

  test("normalizes scopes alongside imports", () => {
    expect(prepareRendererImportMap({ imports: { react: "/react.js" }, scopes: { "/esm/": { react: "/react.js" } } }, "https://example.test/app/")).toEqual({ imports: { react: "https://example.test/react.js" }, scopes: { "/esm/": { react: "https://example.test/react.js" } } });
  });
});

describe("createImportMapResolver", () => {
  test("skips fallback providers once base maps cover every required specifier", async () => {
    let fallbackRuns = 0;
    const resolver = createImportMapResolver([literalImportMap({ imports: { react: "/src/lib/react.ts", "react/": "/src/lib/react/" } }), { kind: "fallback", resolve: () => ((fallbackRuns += 1), { imports: { react: "/wrong.js" } }) }]);
    expect((await resolver.resolve({ code: 'import React from "react"; import { jsx } from "react/jsx-runtime";' })).imports).toEqual({ react: "/src/lib/react.ts", "react/": "/src/lib/react/" });
    expect(fallbackRuns).toBe(0);
  });

  test("lets a later base provider override an earlier one for the same specifier", async () => {
    // StaticGenUIRenderer relies on this: caller bridge entries come after the base renderer map so "@app/chat" can
    // point at a blob: URL instead of whatever the base map (or esm.sh) would otherwise resolve it to.
    const resolver = createImportMapResolver([literalImportMap({ imports: { "@app/chat": "/default-chat.js", react: "/react.js" } }), literalImportMap({ imports: { "@app/chat": "blob:bridge" } })]);
    expect((await resolver.resolve({ code: 'import chat from "@app/chat"; import React from "react";' })).imports).toEqual({ "@app/chat": "blob:bridge", react: "/react.js" });
  });

  test("runs fallback providers only for the still-missing specifiers, in provider order", async () => {
    const resolver = createImportMapResolver([literalImportMap({ imports: { react: "/react.js" } }), esmShFallback({ external: ["react", "zustand"], hasLocalPackage: async (name) => name === "local-pkg" })]);
    expect((await resolver.resolve({ code: 'import React from "react"; import Icon from "lucide-react"; import store from "local-pkg";' })).imports).toEqual({
      react: "/react.js",
      "lucide-react": "https://esm.sh/lucide-react?bundle&target=es2022&external=react,zustand",
      "local-pkg": "/node_modules/local-pkg",
    });
  });

  test("prefetch and resolve share one in-flight url load", async () => {
    let fetchCount = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const resolver = createImportMapResolver([
      urlImportMap("https://example.test/importmap.json", {
        fetch: async () => {
          fetchCount += 1;
          await gate;
          return { ok: true, status: 200, statusText: "OK", json: async () => ({ imports: { react: "/react.js" } }) };
        },
      }),
    ]);
    const prefetch = resolver.prefetch();
    const resolved = resolver.resolve({ code: 'import React from "react";' });
    await Promise.resolve();
    expect(fetchCount).toBe(1);
    release();
    await prefetch;
    expect((await resolved).imports).toEqual({ react: "/react.js" });
    expect(fetchCount).toBe(1);
  });

  test("does not fetch a fallback url map when base providers already cover every specifier", async () => {
    // The lazy-URL-fallback case #1142 calls out: a remote fallback map must not be fetched during resolve() when an
    // earlier base provider already resolved every required specifier.
    let fetchCount = 0;
    const resolver = createImportMapResolver([literalImportMap({ imports: { react: "/react.js" } }), urlImportMap("https://example.test/fallback.json", { kind: "fallback", fetch: async () => ((fetchCount += 1), { ok: true, status: 200, statusText: "OK", json: async () => ({ imports: { react: "/remote.js" } }) }) })]);
    expect((await resolver.resolve({ code: 'import React from "react";' })).imports).toEqual({ react: "/react.js" });
    expect(fetchCount).toBe(0);
  });

  test("prefetch warms base url maps but leaves fallback url maps lazy", async () => {
    // #1142 contract: prefetch() runs from idle/build-time paths with no code, so it can only warm base providers.
    // A fallback provider has nothing to answer until resolve() scans the TSX, so prefetch must not fetch its url.
    let baseFetches = 0;
    let fallbackFetches = 0;
    const resolver = createImportMapResolver([
      urlImportMap("https://example.test/base.json", { fetch: async () => ((baseFetches += 1), { ok: true, status: 200, statusText: "OK", json: async () => ({ imports: { react: "/react.js" } }) }) }),
      urlImportMap("https://example.test/fallback.json", { kind: "fallback", fetch: async () => ((fallbackFetches += 1), { ok: true, status: 200, statusText: "OK", json: async () => ({ imports: { lodash: "/remote-lodash.js" } }) }) }),
    ]);
    await resolver.prefetch();
    expect([baseFetches, fallbackFetches]).toEqual([1, 0]);
  });
});

describe("toEsmShImportUrl", () => {
  test("accepts custom externals for singleton runtime boundaries", () => {
    expect(toEsmShImportUrl("zustand", ["react", "zustand"])).toBe("https://esm.sh/zustand?bundle&target=es2022&external=react,zustand");
  });
});

describe("mergeFallbackImports", () => {
  test("adds esm.sh fallbacks only for unknown bare specifiers", async () => {
    const imports = await mergeFallbackImports({ react: "/src/lib/react.ts" }, 'import React from "react"; import NumberFlow from "@number-flow/react";', { hasLocalPackage: async () => false });
    expect(imports.react).toBe("/src/lib/react.ts");
    expect(imports["@number-flow/react"]).toBe("https://esm.sh/@number-flow/react@0.6.0?bundle&target=es2022&external=react,react-dom,scheduler");
  });

  test("does not send unresolved local aliases to esm.sh", async () => {
    const imports = await mergeFallbackImports({}, 'import { Button } from "@/components/ui/button";', { hasLocalPackage: async () => false });
    expect(imports).toEqual({});
  });

  test("probes local packages concurrently while keeping import order stable", async () => {
    let releaseFirstProbe!: () => void;
    const started: string[] = [];
    const pendingFirstProbe = new Promise<boolean>((resolve) => {
      releaseFirstProbe = () => resolve(false);
    });
    const importsPromise = mergeFallbackImports({}, 'import Icon from "lucide-react"; import local from "local-pkg";', {
      hasLocalPackage: async (packageName) => {
        started.push(packageName);
        if (packageName === "lucide-react") return pendingFirstProbe;
        return true;
      },
    });
    await Promise.resolve();
    expect(started).toEqual(["lucide-react", "local-pkg"]);
    expect(Bun.peek.status(importsPromise)).toBe("pending");
    releaseFirstProbe();
    expect(await importsPromise).toEqual({ "lucide-react": "https://esm.sh/lucide-react?bundle&target=es2022&external=react,react-dom,scheduler", "local-pkg": "/node_modules/local-pkg" });
  });
});
