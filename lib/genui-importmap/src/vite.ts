import fs from "node:fs";
import path from "node:path";
import { isLocalRootRelativeTarget } from "./importMap";

type GenUIImportMapPluginOptions = { imports: Record<string, string>; moduleId: string; importmapFile?: string };
// Keep this structural so Astro's nested Vite types do not conflict with the root Vite package.
type GenUIImportMapPlugin = {
  name: string;
  enforce: "pre";
  config: (_: unknown, env: { command: "build" | "serve" }) => { optimizeDeps: { exclude: string[] } } | undefined;
  configResolved: (config: { root: string }) => void;
  configureServer: () => void;
  resolveId: (id: string) => string | null;
  buildStart: (this: { emitFile: (file: { type: "chunk"; id: string; name: string }) => string }) => void;
  load: (id: string) => string | null;
  handleHotUpdate: (ctx: { file: string }) => unknown[] | void;
  generateBundle: (this: { emitFile: (file: { type: "asset"; fileName: string; source: string }) => void; getFileName: (referenceId: string) => string }) => void;
};
// Vite's real root, captured in configResolved. Defaults to cwd for the Astro path (root === cwd there); the packaged
// CLI sets a repo root that differs from the invocation cwd, so resolving facade paths against cwd would misfire.
let rootDir = process.cwd();
const toPosix = (value: string) => value.split(path.sep).join("/");
const resolvePath = (value: string) => toPosix(path.resolve(rootDir, value));

const resolveLocalTarget = (target: string) => (isLocalRootRelativeTarget(target) ? resolvePath(`.${target}`) : target);
// Algorithm body shared between the Node-side helper and the browser-side runtime helper injected into build output.
// Both must stay in sync; derive the browser helper from this string rather than duplicating the logic.
const importMetaSearchParamsBody = `  const targetUrl = new URL(target, importMetaUrl);
  const importerUrl = new URL(importMetaUrl);
  for (const [key, value] of importerUrl.searchParams) if (!targetUrl.searchParams.has(key)) targetUrl.searchParams.append(key, value);
  return targetUrl.href;`;
export const appendImportMetaSearchParams = new Function("target", "importMetaUrl", importMetaSearchParamsBody) as (target: string, importMetaUrl: string) => string;
const importMetaSearchHelper = `const withImportMetaSearch = (target) => {
  const importMetaUrl = import.meta.url;
${importMetaSearchParamsBody}
};`;

// Content-hash all /src/* import targets; the resulting version stays stable when no facade source has changed.
const computeDevImportVersion = (imports: Record<string, string>) => {
  let h = 0;
  for (const target of Object.values(imports).toSorted()) {
    if (!target.startsWith("/src/")) continue;
    try {
      const text = fs.readFileSync(path.resolve(rootDir, `.${target}`), "utf8");
      for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    } catch {}
  }
  return (h >>> 0).toString(36);
};

// Rollup chunk names must be filename-safe; the resolved files land in _astro/<name>.<hash>.js.
export const toGenUIChunkName = (specifier: string) =>
  `genui-${specifier
    .replace(/^@\//, "src/")
    .replace(/^@/, "at-")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+/, "")}`;

export function genUIImportMapPlugin(options: GenUIImportMapPluginOptions): GenUIImportMapPlugin {
  const { imports: localImports, moduleId: importmapModuleId } = options;
  const virtualImportmapId = `\0${importmapModuleId}`;
  const devImportmapFile = "node_modules/.genui/importmap.json";
  const buildImportmapFile = options.importmapFile ?? "dist/client/importmap.json";
  let command: "build" | "serve" = "serve";
  // specifier -> Rollup reference id of its emitted chunk; populated in buildStart, resolved to hashed names later.
  const chunkReferenceIds: Record<string, string> = {};
  const writeDevImportMap = () => {
    const file = path.resolve(rootDir, devImportmapFile);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const version = computeDevImportVersion(localImports);
    fs.writeFileSync(file, JSON.stringify({ imports: localImports, version }, null, 2));
  };
  // Absolute paths of /src/* facade targets, for matching handleHotUpdate files. Populated in configResolved once
  // the real root is known.
  let watchedSrcFiles = new Set<string>();
  return {
    name: "macaron-genui-importmap",
    enforce: "pre",
    config(_, env) {
      command = env.command;
      return { optimizeDeps: { exclude: [importmapModuleId] } };
    },
    configResolved(config) {
      rootDir = config.root;
      watchedSrcFiles = new Set(
        Object.values(localImports)
          .filter((t) => t.startsWith("/src/"))
          .map((t) => path.resolve(rootDir, `.${t}`)),
      );
      if (command === "serve") writeDevImportMap();
    },
    configureServer() {
      writeDevImportMap();
    },
    resolveId(id) {
      return id === importmapModuleId ? virtualImportmapId : null;
    },
    buildStart() {
      if (command !== "build") return;
      for (const [specifier, target] of Object.entries(localImports)) chunkReferenceIds[specifier] = this.emitFile({ type: "chunk", id: resolveLocalTarget(target), name: toGenUIChunkName(specifier) });
    },
    handleHotUpdate({ file }) {
      // Rewrite the importmap JSON (refreshing its content-hash version) when a watched /src/* facade is saved;
      // a no-op save just rewrites the same version. Let Vite's default HMR propagation run.
      if (command === "serve" && watchedSrcFiles.has(file)) writeDevImportMap();
    },
    load(id) {
      if (id !== virtualImportmapId) return null;
      if (command === "serve") return `import { prepareRendererImportMap } from "@genui/importmap";\nconst rawImportMap = ${JSON.stringify({ imports: localImports }, null, 2)};\nexport default prepareRendererImportMap(rawImportMap);\n`;
      // ROLLUP_FILE_URL_<ref> becomes new URL("chunk.js", import.meta.url).href. Vercel skew protection adds ?dpl to module imports; inherit that query here so generated TSX and the host app share one React/component graph.
      const entries = Object.entries(chunkReferenceIds).map(([specifier, referenceId]) => `  ${JSON.stringify(specifier)}: withImportMetaSearch(import.meta.ROLLUP_FILE_URL_${referenceId}),`);
      return `${importMetaSearchHelper}\nexport default { imports: {\n${entries.join("\n")}\n} };\n`;
    },
    generateBundle() {
      const imports = Object.fromEntries(Object.entries(chunkReferenceIds).map(([specifier, referenceId]) => [specifier, `/${this.getFileName(referenceId)}`]));
      this.emitFile({ type: "asset", fileName: buildImportmapFile.replace(/^dist\/client\//, ""), source: JSON.stringify({ imports }, null, 2) });
    },
  };
}
