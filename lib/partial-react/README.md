# partial-react

Renderer for generated React/TSX.

## Input

`GenUIRenderer` accepts TSX source strings:

```ts
import { GenUIRenderer } from "partial-react";

const renderer = await GenUIRenderer.create(document.getElementById("preview"), {
  preserveStateOnUpdate: true,
  callbacks: {
    onRendered: (_component, code) => console.log(code),
    onError: (error, phase) => console.error(phase, error),
  },
});

renderer.render("export default function App() { return <div>Hello world</div>; }");
```

## Output

- The target element receives a React preview.
- `onReady(component, url, code)` fires after a module compiles and imports.
- `onRendered(component, code, serial)` fires after React commits.
- `onError(error, phase)` reports `"transform"`, `"compile"`, or `"render"`.

## Imports

```ts
import { GenUIRenderer } from "partial-react";
import { createTsxCompiler } from "partial-react/compiler";
import { mergeFallbackImports, prepareRendererImportMap } from "@genui/importmap";
import { useGenUIRenderContext } from "partial-react/render-context";
```

## State and Streaming

- Keep `preserveStateOnUpdate: true` for normal previews. It preserves useful React state and DOM continuity across regenerated code.
- Set `preserveStateOnUpdate: false` only when every update should remount from scratch, usually while debugging renderer state bugs.
- Use the preview wrapper's `streaming` prop (`GenUIPreviewHost` / `StaticGenUIRenderer`) when the input is still growing or being patched in place. It treats the code as partial TSX and avoids surfacing transient mid-stream errors.
- Leave `streaming` off for complete snapshots, final answers, history replay, and deterministic one-shot renders.

## Corner Cases

- `render(code)` replaces the current buffer with a complete TSX module.
- `clear({ preserveVisualState: true })` clears pending code but leaves the last visual tree in place.
- Missing default exports fail at compile/import time.
- Render failures call `onError` and, with state preservation on, try to restore the last good component.

## Test

```sh
bun test lib/partial-react
```
