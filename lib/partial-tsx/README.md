# partial-tsx

Completes prefix-growing TSX.

## Input

```ts
import { completePartialTsx, normalizeGeneratedTsx } from "partial-tsx";

completePartialTsx("<div>Hello");
normalizeGeneratedTsx("function Card() { return <button>OK");
```

## Output

- `completePartialTsx(code)` returns syntactically safer TSX for a partial prefix.
- `normalizeGeneratedTsx(code)` returns renderer-ready TSX:
  - Markdown fences removed.
  - Safe partial syntax completed.
  - Missing default export added when a component can be found.
  - Missing imports added for known React hooks such as `useState`.

## Corner Cases

- Incomplete component/tag names are left alone when completing them would likely render the wrong element.
- Unterminated JSX string attributes can be closed; incomplete expression attributes are dropped.
- Void HTML tags are normalized as self-closing tags.
- Unknown hooks or custom hooks are not auto-imported.
- Existing default exports are preserved.
- Invalid TypeScript semantics are not repaired.

## Test

```sh
bun test lib/partial-tsx
```
