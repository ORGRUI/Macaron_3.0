import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act, createElement, useState } from "react";
import type { ReactNode } from "react";
import type { TsxCompiler } from "./compiler";
import { GenUIRenderContext } from "./renderContext";
import { getGenUIHookSignature } from "./hookSignature";
import { GenUIRenderer } from "./runtime";

const compiler: TsxCompiler = {
  async compile(code, options) {
    return { code: `export default function App(){ return null; }\n// ${code.length}`, source: code, changed: code !== options?.previousCode };
  },
};
const installTestDom = () => {
  const testWindow = new Window({ url: "http://localhost/" });
  Object.defineProperty(testWindow, "SyntaxError", { configurable: true, value: SyntaxError });
  const previous = Object.fromEntries(["window", "document", "HTMLElement", "Node", "navigator", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [key, (globalThis as Record<string, unknown>)[key]]));
  for (const [key, value] of Object.entries({
    window: testWindow,
    document: testWindow.document,
    HTMLElement: testWindow.HTMLElement,
    Node: testWindow.Node,
    navigator: testWindow.navigator,
    requestAnimationFrame: testWindow.requestAnimationFrame.bind(testWindow),
    cancelAnimationFrame: testWindow.cancelAnimationFrame.bind(testWindow),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete (globalThis as Record<string, unknown>)[key];
      else Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    testWindow.close();
  };
};

describe("GenUIRenderer update buffer", () => {
  test("tracks render and push modes independently", async () => {
    const renderer = await GenUIRenderer.create(null, { compiler });
    renderer.render("abc");
    expect(renderer.getCurrentBuffer()).toBe("abc");
    expect(renderer.getUpdateMode()).toBe("render");
    renderer.pushCode("def");
    expect(renderer.getCurrentBuffer()).toBe("abcdef");
    expect(renderer.getUpdateMode()).toBe("push");
  });

  test("returns to partial compilation after a full render receives push updates", async () => {
    const partialFlags: Array<boolean | undefined> = [];
    const renderer = await GenUIRenderer.create(null, {
      compiler: {
        async compile(code, options) {
          partialFlags.push(options?.partial);
          return { code: "", source: code, changed: false };
        },
      },
    });
    renderer.render("function App() { return <div>");
    await Promise.resolve();
    renderer.pushCode("Hi");
    await Promise.resolve();
    expect(partialFlags).toEqual([false, true]);
  });

  test("compiles a replacement push as partial after preserving visual state", async () => {
    const frames: string[] = [];
    const renderer = await GenUIRenderer.create(null, {
      compiler: {
        async compile(code, options) {
          frames.push(`${code}:${String(options?.partial)}`);
          return { code: "", source: code, changed: false };
        },
      },
    });
    renderer.render("complete");
    await Promise.resolve();
    renderer.clear({ preserveVisualState: true });
    renderer.pushCode("partial <div");
    await Promise.resolve();
    expect(frames).toEqual(["complete:false", "partial <div:true"]);
  });

  test("can compile every pushed frame without microtask coalescing", async () => {
    const frames: string[] = [];
    const renderer = await GenUIRenderer.create(null, {
      flushMode: "immediate",
      compiler: {
        async compile(code, options) {
          frames.push(`${code}:${String(options?.partial)}`);
          return { code: "", source: code, changed: false };
        },
      },
    });
    renderer.pushCode("a");
    renderer.pushCode("b");
    renderer.pushCode("c");
    expect(frames).toEqual(["a:true", "ab:true", "abc:true"]);
  });

  test("finishes streaming with the final source instead of the previous partial buffer", async () => {
    const frames: string[] = [];
    const renderer = await GenUIRenderer.create(null, {
      flushMode: "immediate",
      compiler: {
        async compile(code, options) {
          frames.push(`${code}:${String(options?.partial)}`);
          return { code: "", source: code, changed: false };
        },
      },
    });
    renderer.pushCode("partial <a");
    renderer.finish("final <a></a>");
    expect(frames).toEqual(["partial <a:true", "final <a></a>:false"]);
  });

  test("clears a pending frame without compiling stale code", async () => {
    const frames: string[] = [];
    const renderer = await GenUIRenderer.create(null, {
      compiler: {
        async compile(code) {
          frames.push(code);
          return { code: "", source: code, changed: false };
        },
      },
    });
    renderer.pushCode("stale");
    renderer.clear();
    await Promise.resolve();
    expect(renderer.getCurrentBuffer()).toBe("");
    expect(frames).toEqual([]);
  });

  test("clears an in-flight immediate frame without rendering stale code", async () => {
    const readyCodes: string[] = [];
    let resolveFirst: ((result: Awaited<ReturnType<TsxCompiler["compile"]>>) => void) | undefined;
    let firstSettled: Promise<void> | undefined;
    const renderer = await GenUIRenderer.create(null, {
      flushMode: "immediate",
      compiler: {
        async compile(code) {
          if (code === "stale") {
            const first = new Promise<Awaited<ReturnType<TsxCompiler["compile"]>>>((resolve) => {
              resolveFirst = resolve;
            });
            firstSettled = first.then(() => {});
            return first;
          }
          return { code: "", source: code, changed: false };
        },
      },
      callbacks: { onReady: (_component, _url, code) => readyCodes.push(code ?? "") },
    });
    renderer.pushCode("stale");
    expect(resolveFirst).toBeDefined();
    renderer.clear();
    resolveFirst?.({ code: "export default function App(){ return null; }", source: "stale", changed: true });
    await firstSettled;
    await Bun.sleep(0);
    expect(renderer.getCurrentBuffer()).toBe("");
    expect(readyCodes).toEqual([]);
  });

  test("ignores transform errors from stale frames", async () => {
    const errors: string[] = [];
    let rejectFirst: ((error: Error) => void) | undefined;
    let firstSettled: Promise<void> | undefined;
    const renderer = await GenUIRenderer.create(null, {
      flushMode: "immediate",
      compiler: {
        async compile(code) {
          if (code === "bad") {
            const first = new Promise<never>((_, reject) => {
              rejectFirst = reject;
            });
            firstSettled = first.catch(() => {});
            return first;
          }
          return { code: "", source: code, changed: false };
        },
      },
      callbacks: { onError: (error) => errors.push(error.message) },
    });
    renderer.render("bad");
    renderer.render("good");
    expect(rejectFirst).toBeDefined();
    rejectFirst?.(new Error("stale"));
    await firstSettled;
    await Promise.resolve();
    expect(errors).toEqual([]);
  });

  test("reuses compiled components for identical transformed code", async () => {
    const loadCountKey = "__genuiRuntimeCacheLoadCount";
    delete (globalThis as Record<string, unknown>)[loadCountKey];
    const readyResolvers: Array<() => void> = [];
    const compiledCode = `globalThis[${JSON.stringify(loadCountKey)}] = (globalThis[${JSON.stringify(loadCountKey)}] ?? 0) + 1;\nexport default function App(){ return null; }`;
    const renderer = await GenUIRenderer.create(null, {
      compiler: {
        async compile(code) {
          return { code: compiledCode, source: code, changed: true };
        },
      },
      callbacks: { onReady: () => readyResolvers.shift()?.() },
    });
    const waitForReady = () =>
      new Promise<void>((resolve) => {
        readyResolvers.push(resolve);
      });
    let ready = waitForReady();
    renderer.render("first");
    await ready;
    ready = waitForReady();
    renderer.render("second");
    await ready;
    expect((globalThis as Record<string, unknown>)[loadCountKey]).toBe(1);
    renderer.detach();
    delete (globalThis as Record<string, unknown>)[loadCountKey];
  });

  test("does not acknowledge unchanged code after a failed import", async () => {
    const goodCode = `export default function App(){ return null; }`;
    const badCode = `throw new Error("import failed");\nexport default function App(){ return null; }`;
    const terminals: string[] = [];
    let resolveReady: (() => void) | undefined;
    let resolveTerminal: (() => void) | undefined;
    const waitForTerminal = () =>
      new Promise<void>((resolve) => {
        resolveTerminal = resolve;
      });
    const renderer = await GenUIRenderer.create(null, {
      compiler: {
        async compile(code, options) {
          const compiled = code === "bad" ? badCode : goodCode;
          return { code: compiled, source: code, changed: compiled !== options?.previousCode };
        },
      },
      callbacks: {
        onReady: (_component, _url, code) => {
          if (code === "good") resolveReady?.();
        },
        onRendered: (_component, code) => {
          terminals.push(`rendered:${code}`);
          resolveTerminal?.();
        },
        onError: (_error, phase) => {
          terminals.push(`error:${phase}`);
          resolveTerminal?.();
        },
      },
    });
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    renderer.render("good");
    await ready;
    let terminal = waitForTerminal();
    renderer.render("bad");
    await terminal;
    terminal = waitForTerminal();
    renderer.render("bad");
    await terminal;
    expect(terminals).toEqual(["error:compile", "error:compile"]);
  });

  test("delays unchanged render callbacks through the runtime notifier", async () => {
    const globals = globalThis as typeof globalThis & { requestAnimationFrame?: (callback: FrameRequestCallback) => number };
    const previousRequestAnimationFrame = globals.requestAnimationFrame;
    const frames: FrameRequestCallback[] = [];
    const events: string[] = [];
    globals.requestAnimationFrame = (callback) => {
      frames.push(callback);
      return frames.length;
    };
    try {
      const renderer = await GenUIRenderer.create(null, {
        flushMode: "immediate",
        compiler: {
          async compile(code) {
            return { code: "", source: code, changed: false };
          },
        },
        callbacks: {
          onRendered: (_component, code, serial) => events.push(`${code}:${String(serial)}`),
        },
      });
      (renderer as unknown as { slot: { setCurrent: (component: unknown) => void } }).slot.setCurrent(() => null);
      renderer.render("same", 7);
      await Promise.resolve();
      expect(events).toEqual([]);
      expect(frames).toHaveLength(1);
      frames[0](0);
      expect(events).toEqual(["same:7"]);
    } finally {
      if (previousRequestAnimationFrame === undefined) delete (globals as Record<string, unknown>).requestAnimationFrame;
      else globals.requestAnimationFrame = previousRequestAnimationFrame;
    }
  });

  test("resets the error boundary in place after an initial render error without last good state", async () => {
    const rendered: Array<{ key: string | null; props: { resetKey?: number; onError?: (error: Error) => void } }> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      root: { render: (element: { key: string | null; props: { resetKey?: number; onError?: (error: Error) => void } }) => void };
      slot: { setCurrent: (component: unknown) => void };
      renderComponent: (component?: unknown) => void;
    };
    const Bad = () => null;
    const Good = () => null;
    renderer.root = { render: (element) => rendered.push(element) };
    renderer.slot.setCurrent(Bad);
    renderer.renderComponent(Bad);
    rendered.at(-1)?.props.onError?.(new Error("bad"));
    renderer.slot.setCurrent(Good);
    renderer.renderComponent(Good);
    // Boundary fiber must stay mounted (stable key) while resetKey bumps to clear caught state.
    expect(rendered.map((element) => element.key)).toEqual(["boundary", "boundary"]);
    expect(rendered.map((element) => element.props.resetKey)).toEqual([0, 1]);
  });

  test("remounts the preserved wrapper when the generated hook layout changes", async () => {
    const keys: Array<string | null> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      root: { render: (element: { key: string | null }) => void };
      slot: { setCurrent: (component: unknown) => void };
      renderComponent: (component?: unknown, renderedCode?: string, renderSerial?: number, sourceCode?: string) => void;
    };
    const App = () => null;
    renderer.root = { render: (element) => keys.push(element.key) };
    renderer.slot.setCurrent(App);
    renderer.renderComponent(App, "one", undefined, "function App(){ const [text] = useState('kept-state'); return <input value={text} />; }");
    renderer.renderComponent(App, "two", undefined, "function App(){ const [a] = useState('asdf'); const [text] = useState('kept-state'); return <input value={a} />; }");
    renderer.renderComponent(App, "three", undefined, "function App(){ const [a] = useState('zxcv'); const [text] = useState('kept-state'); return <input value={a} />; }");
    expect(keys).toEqual(["boundary", "boundary:1", "boundary:1"]);
  });

  test("updates real input state when an inserted hook remounts the preserved wrapper", async () => {
    const cleanup = installTestDom();
    let detach: (() => void) | undefined;
    try {
      const host = document.createElement("div");
      document.body.append(host);
      const renderer = (await GenUIRenderer.create(host, { compiler, preserveStateOnUpdate: true })) as unknown as {
        detach: () => void;
        slot: { setCurrent: (component: unknown) => void };
        renderComponent: (component?: unknown, renderedCode?: string, renderSerial?: number, sourceCode?: string) => void;
      };
      detach = () => renderer.detach();
      const OneHook = () => {
        const [text] = useState("kept-state");
        return createElement("input", { value: text, readOnly: true });
      };
      const TwoHooks = () => {
        const [a] = useState("asdf");
        const [text] = useState("kept-state");
        void text;
        return createElement("input", { value: a, readOnly: true });
      };
      renderer.slot.setCurrent(OneHook);
      act(() => {
        renderer.renderComponent(OneHook, "one", undefined, "function App(){ const [text] = useState('kept-state'); return <input value={text} />; }");
      });
      expect(host.querySelector("input")?.value).toBe("kept-state");
      renderer.slot.setCurrent(TwoHooks);
      act(() => {
        renderer.renderComponent(TwoHooks, "two", undefined, "function App(){ const [a] = useState('asdf'); const [text] = useState('kept-state'); return <input value={a} />; }");
      });
      expect(host.querySelector("input")?.value).toBe("asdf");
    } finally {
      act(() => detach?.());
      cleanup();
    }
  });

  test("does not persist failed hook signatures after restoring the last good component", async () => {
    const rendered: Array<{ key: string | null; props: { onError?: (error: Error) => void } }> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      lastGoodHookSignature: string;
      lastHookSignature: string;
      root: { render: (element: { key: string | null; props: { onError?: (error: Error) => void } }) => void };
      slot: { setCurrent: (component: unknown) => void; markRendered: (component?: unknown) => void };
      renderComponent: (component?: unknown, renderedCode?: string, renderSerial?: number, sourceCode?: string) => void;
    };
    const LastGood = () => null;
    const Bad = () => null;
    const Fixed = () => null;
    const oneHook = "function App(){ const [text] = useState('kept-state'); return <input value={text} />; }";
    const twoHooks = "function App(){ const [a] = useState('asdf'); const [text] = useState('kept-state'); return <input value={a} />; }";
    renderer.root = { render: (element) => rendered.push(element) };
    renderer.slot.setCurrent(LastGood);
    renderer.slot.markRendered(LastGood);
    renderer.lastGoodHookSignature = getGenUIHookSignature(oneHook);
    renderer.lastHookSignature = getGenUIHookSignature(oneHook);
    renderer.slot.setCurrent(Bad);
    renderer.renderComponent(Bad, "bad", undefined, twoHooks);
    rendered.at(-1)?.props.onError?.(new Error("bad"));
    expect(renderer.lastHookSignature).toBe(getGenUIHookSignature(oneHook));
    renderer.slot.setCurrent(Fixed);
    renderer.renderComponent(Fixed, "fixed", undefined, twoHooks);
    expect(rendered.map((element) => element.key)).toEqual(["boundary:1", "boundary:2", "boundary:3"]);
  });

  test("updates real input state when a generic hook layout change remounts", async () => {
    const cleanup = installTestDom();
    let detach: (() => void) | undefined;
    try {
      const host = document.createElement("div");
      document.body.append(host);
      const renderer = (await GenUIRenderer.create(host, { compiler, preserveStateOnUpdate: true })) as unknown as {
        detach: () => void;
        slot: { setCurrent: (component: unknown) => void };
        renderComponent: (component?: unknown, renderedCode?: string, renderSerial?: number, sourceCode?: string) => void;
      };
      detach = () => renderer.detach();
      const WithGenericRef = () => {
        const [a] = useState("state-cell");
        const [text] = useState("kept-state");
        void text;
        return createElement("input", { value: a, readOnly: true });
      };
      const WithoutRef = () => {
        const [text] = useState("new-state");
        return createElement("input", { value: text, readOnly: true });
      };
      renderer.slot.setCurrent(WithGenericRef);
      act(() => {
        renderer.renderComponent(WithGenericRef, "generic", undefined, "function App(){ const ref = useRef<HTMLDivElement>(null); const [text] = useState('state-cell'); return <input ref={ref} value={text} />; }");
      });
      expect(host.querySelector("input")?.value).toBe("state-cell");
      renderer.slot.setCurrent(WithoutRef);
      act(() => {
        renderer.renderComponent(WithoutRef, "plain", undefined, "function App(){ const [text] = useState('new-state'); return <input value={text} />; }");
      });
      expect(host.querySelector("input")?.value).toBe("new-state");
    } finally {
      act(() => detach?.());
      cleanup();
    }
  });

  test("keeps the stable wrapper fiber across streaming frames and remounts only when the hook layout changes", async () => {
    // Streaming frames stay on the preserve boundary so state survives while typing; the hook-signature diff remounts the
    // stable wrapper only when the hook count changes between frames, which is what prevents reusing wrong hook cells (#310).
    const keys: Array<string | null> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      root: { render: (element: { key: string | null }) => void };
      slot: { setCurrent: (component: unknown) => void };
      renderComponent: (component?: unknown, renderedCode?: string, renderSerial?: number, sourceCode?: string) => void;
      updateMode: string;
      finished: boolean;
    };
    const App = () => null;
    renderer.root = { render: (element) => keys.push(element.key) };
    renderer.slot.setCurrent(App);
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent(App, "x", undefined, "useState();");
    renderer.renderComponent(App, "x", undefined, "useState();");
    renderer.renderComponent(App, "x", undefined, "useState();useEffect(()=>{});");
    expect(keys).toEqual(["boundary", "boundary", "boundary:1"]);
  });

  test("remounts when the first hook appears after a hookless frame", async () => {
    // Streaming commonly emits JSX first and the first useState later; a hookless frame's signature is "" which must not be
    // mistaken for "no previous frame", or the 0→1 hook transition reuses a 0-hook fiber with 1 hook and hits React #310.
    const keys: Array<string | null> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      root: { render: (element: { key: string | null }) => void };
      slot: { setCurrent: (component: unknown) => void };
      renderComponent: (component?: unknown, renderedCode?: string, renderSerial?: number, sourceCode?: string) => void;
      updateMode: string;
      finished: boolean;
    };
    const App = () => null;
    renderer.root = { render: (element) => keys.push(element.key) };
    renderer.slot.setCurrent(App);
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent(App, "x", undefined, "return <div/>;");
    renderer.renderComponent(App, "x", undefined, "const [a]=useState(0); return <div/>;");
    expect(keys).toEqual(["boundary", "boundary:1"]);
  });

  test("provides streaming render context to generated components", async () => {
    const values: Array<{ rendererScope: string; streamingPartialFrame: boolean; nextStreamingRenderKey?: () => string }> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      root: { render: (element: { props: { children: Array<{ type: unknown; props: { value: { rendererScope: string; streamingPartialFrame: boolean; nextStreamingRenderKey?: () => string } } }> } }) => void };
      slot: { setCurrent: (component: unknown) => void };
      renderComponent: (component?: unknown) => void;
      updateMode: string;
      finished: boolean;
    };
    const App = () => null;
    renderer.root = {
      render: (element) => {
        const provider = element.props.children[0];
        expect(provider.type).toBe(GenUIRenderContext.Provider);
        values.push(provider.props.value);
      },
    };
    renderer.slot.setCurrent(App);
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent(App);
    renderer.finished = true;
    renderer.renderComponent(App);
    expect(values[0].streamingPartialFrame).toBe(true);
    expect(values[1].streamingPartialFrame).toBe(false);
    expect(values[0].rendererScope).toBe(values[1].rendererScope);
    expect(values[0].rendererScope).toStartWith("renderer:");
    expect(values[0].nextStreamingRenderKey?.()).toBe("chart-0");
    expect(values[0].nextStreamingRenderKey?.()).toBe("chart-1");
    expect(values[1].nextStreamingRenderKey?.()).toBe("chart-0");
  });

  test("rotates renderer scope after clear so streaming snapshots cannot leak into the next stream", async () => {
    const values: Array<{ rendererScope: string; streamingPartialFrame: boolean }> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      clear: () => void;
      root: { render: (element: { props: { children: Array<{ type: unknown; props: { value: { rendererScope: string; streamingPartialFrame: boolean } } }> } } | null) => void };
      slot: { setCurrent: (component: unknown) => void };
      renderComponent: (component?: unknown) => void;
      updateMode: string;
      finished: boolean;
    };
    const App = () => null;
    renderer.root = {
      render: (element) => {
        if (!element) return;
        const provider = element.props.children[0];
        values.push(provider.props.value);
      },
    };
    renderer.slot.setCurrent(App);
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent(App);
    renderer.clear();
    renderer.slot.setCurrent(App);
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent(App);
    expect(values[0].rendererScope).not.toBe(values[1].rendererScope);
  });

  test("preserves renderer scope and current component when clearing only the streaming buffer", async () => {
    const values: Array<{ rendererScope: string; streamingPartialFrame: boolean }> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      clear: (options?: { preserveVisualState?: boolean }) => void;
      getCurrentBuffer: () => string;
      root: { render: (element: { props: { children: Array<{ type: unknown; props: { value: { rendererScope: string; streamingPartialFrame: boolean } } }> } } | null) => void };
      slot: { setCurrent: (component: unknown) => void };
      renderComponent: (component?: unknown) => void;
      updateMode: string;
      finished: boolean;
    };
    const App = () => null;
    renderer.root = {
      render: (element) => {
        if (!element) return;
        const provider = element.props.children[0];
        values.push(provider.props.value);
      },
    };
    renderer.slot.setCurrent(App);
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent(App);
    renderer.clear({ preserveVisualState: true });
    expect(renderer.getCurrentBuffer()).toBe("");
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent();
    expect(values[0].rendererScope).toBe(values[1].rendererScope);
  });

  test("stays on the preserve path when finishing a stream with unchanged compiled output", async () => {
    const keys: Array<string | null> = [];
    const compiledCode = `export default function App(){ return null; }`;
    const renderer = (await GenUIRenderer.create(null, {
      flushMode: "immediate",
      preserveStateOnUpdate: true,
      compiler: {
        async compile(code, options) {
          return { code: compiledCode, source: code, changed: compiledCode !== options?.previousCode };
        },
      },
    })) as unknown as {
      root: { render: (element: { key: string | null }) => void };
      slot: { setCurrent: (component: unknown) => void };
      lastCompiledCode: string;
      currentBuffer: string;
      updateMode: string;
      finished: boolean;
      renderComponent: (component?: unknown) => void;
      finish: () => void;
    };
    const App = () => null;
    renderer.root = { render: (element) => keys.push(element.key) };
    renderer.slot.setCurrent(App);
    renderer.lastCompiledCode = compiledCode;
    renderer.currentBuffer = "complete";
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent(App);
    renderer.finish();
    await Promise.resolve();
    expect(keys).toEqual(["boundary", "boundary"]);
  });

  test("does not recursively restore when the last good component also fails", async () => {
    const rendered: Array<{ key: string | null; props: { resetKey?: number; onError?: (error: Error) => void } }> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      root: { render: (element: { key: string | null; props: { resetKey?: number; onError?: (error: Error) => void } }) => void };
      slot: { setCurrent: (component: unknown) => void; markRendered: (component?: unknown) => void };
      renderComponent: (component?: unknown) => void;
    };
    const LastGood = () => null;
    const Bad = () => null;
    renderer.root = { render: (element) => rendered.push(element) };
    renderer.slot.setCurrent(LastGood);
    renderer.slot.markRendered(LastGood);
    renderer.slot.setCurrent(Bad);
    renderer.renderComponent(Bad);
    rendered.at(-1)?.props.onError?.(new Error("bad"));
    rendered.at(-1)?.props.onError?.(new Error("last good also bad"));
    expect(rendered.map((element) => element.key)).toEqual(["boundary", "boundary"]);
    expect(rendered.map((element) => element.props.resetKey)).toEqual([0, 1]);
  });

  test("preflights transient streaming render errors before touching the visible root", async () => {
    const rendered: Array<{ props: { onError?: (error: Error) => void } }> = [];
    const errors: string[] = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      callbacks: { onError?: (error: Error, phase: "render") => void };
      root: { render: (element: { props: { onError?: (error: Error) => void } }) => void };
      slot: { setCurrent: (component: unknown) => void; markRendered: (component?: unknown) => void };
      updateMode: string;
      finished: boolean;
      renderComponent: (component?: unknown) => void;
    };
    const LastGood = () => null;
    const Partial = () => {
      throw new Error("partial frame failed");
    };
    renderer.callbacks.onError = (error, phase) => errors.push(`${phase}:${error.message}`);
    renderer.root = { render: (element) => rendered.push(element) };
    renderer.slot.setCurrent(LastGood);
    renderer.slot.markRendered(LastGood);
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent(LastGood);
    renderer.slot.setCurrent(Partial);
    renderer.renderComponent(Partial);
    expect(errors).toEqual(["render:partial frame failed"]);
    expect(rendered).toHaveLength(1);
  });

  test("preflights streaming partials with render-time React warnings before touching the visible root", async () => {
    const rendered: unknown[] = [];
    const errors: string[] = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      callbacks: { onError?: (error: Error, phase: "render") => void };
      root: { render: (element: unknown) => void };
      slot: { setCurrent: (component: unknown) => void; markRendered: (component?: unknown) => void };
      updateMode: string;
      finished: boolean;
      renderComponent: (component?: unknown) => void;
    };
    const LastGood = () => null;
    const Partial = () => createElement("div", null, [].map as unknown as ReactNode);
    renderer.callbacks.onError = (error, phase) => errors.push(`${phase}:${error.message}`);
    renderer.root = { render: (element) => rendered.push(element) };
    renderer.slot.setCurrent(LastGood);
    renderer.slot.markRendered(LastGood);
    renderer.updateMode = "push";
    renderer.finished = false;
    renderer.renderComponent(LastGood);
    renderer.slot.setCurrent(Partial);
    renderer.renderComponent(Partial);
    expect(errors[0]).toStartWith("render:Functions are not valid as a React child.");
    expect(rendered).toHaveLength(1);
  });

  test("marks successful commits before delaying external rendered callbacks", async () => {
    const rendered: Array<{ key: string | null; props: { resetKey?: number; onError?: (error: Error) => void; children: Array<{ props: { onCommit?: () => void; onReady?: () => void } }> } }> = [];
    const renderer = (await GenUIRenderer.create(null, { compiler, preserveStateOnUpdate: true })) as unknown as {
      root: { render: (element: { key: string | null; props: { resetKey?: number; onError?: (error: Error) => void; children: Array<{ props: { onCommit?: () => void; onReady?: () => void } }> } }) => void };
      slot: { setCurrent: (component: unknown) => void };
      renderComponent: (component?: unknown) => void;
    };
    const App = () => null;
    renderer.root = { render: (element) => rendered.push(element) };
    renderer.slot.setCurrent(App);
    renderer.renderComponent(App);
    rendered.at(-1)?.props.children.at(-1)?.props.onCommit?.();
    rendered.at(-1)?.props.onError?.(new Error("bad after commit"));
    expect(rendered.map((element) => element.key)).toEqual(["boundary"]);
    expect(rendered.map((element) => element.props.resetKey)).toEqual([0]);
  });

  test("does not rerender the current component when reattached to the same target", async () => {
    const target = {} as HTMLElement;
    const renderer = (await GenUIRenderer.create(null, { compiler })) as unknown as {
      attach: (target: HTMLElement) => void;
      root: { render: (element: unknown) => void; unmount: () => void } | null;
      slot: { setCurrent: (component: unknown) => void };
      target: HTMLElement | null;
    };
    const rendered: unknown[] = [];
    renderer.root = { render: (element) => rendered.push(element), unmount: () => {} };
    renderer.target = target;
    renderer.slot.setCurrent(() => null);
    renderer.attach(target);
    expect(rendered).toHaveLength(0);
  });

  test("revokes the current compiled module url on clear", async () => {
    const originalRevoke = URL.revokeObjectURL;
    const revoked: string[] = [];
    URL.revokeObjectURL = ((url: string) => {
      revoked.push(url);
      originalRevoke.call(URL, url);
    }) as typeof URL.revokeObjectURL;
    try {
      const readyUrls: string[] = [];
      let resolveReady: (() => void) | undefined;
      const renderer = await GenUIRenderer.create(null, {
        compiler: {
          async compile(code) {
            return { code: `export default function App(){ return null; }\n// ${code}`, source: code, changed: true };
          },
        },
        callbacks: {
          onReady: (_component, url) => {
            if (url) readyUrls.push(url);
            resolveReady?.();
          },
        },
      });
      const ready = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
      renderer.render("first");
      await ready;
      renderer.clear();
      expect(revoked).toContain(readyUrls[0]);
    } finally {
      URL.revokeObjectURL = originalRevoke;
    }
  });

  test("cancels an in-flight compile when detached so its blob url is never adopted", async () => {
    const readyUrls: string[] = [];
    let resolveCompile: ((result: Awaited<ReturnType<TsxCompiler["compile"]>>) => void) | undefined;
    const renderer = await GenUIRenderer.create(null, {
      flushMode: "immediate",
      compiler: {
        compile: () =>
          new Promise((resolve) => {
            resolveCompile = resolve;
          }),
      },
      callbacks: {
        onReady: (_component, url) => {
          if (url) readyUrls.push(url);
        },
      },
    });
    renderer.render("pending");
    expect(resolveCompile).toBeDefined();
    renderer.detach();
    resolveCompile?.({ code: `export default function App(){ return null; }\n// pending`, source: "pending", changed: true });
    await Bun.sleep(0);
    expect(readyUrls).toEqual([]);
  });
});
