import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { Rule, UserShortcuts } from "@unocss/core";
import type { Theme } from "@unocss/preset-wind3";

const SCOPED_UNO_STYLE_ATTR = "data-genui-unocss-runtime";

type StyleScopeOptions = { scopeClass: string; theme: Theme; shortcuts?: UserShortcuts<Theme>; rules?: Rule<Theme>[] };
type StyleScopeProps = { active?: boolean; code?: string; children: ReactNode };
type ScopedUnoController = { destroy: () => void };
type SharedScopedUnoRuntime = { retain: () => () => void; extract: (source: string) => Promise<void>; observe: (root: Element) => Promise<ScopedUnoController> };
type StyleScopeContextValue = { prime: (code: string) => Promise<void> };

const StyleScopeContext = createContext<StyleScopeContextValue | null>(null);
export const useStyleScope = () => useContext(StyleScopeContext);

const createSharedScopedUnoRuntime = async ({ scopeClass, theme, shortcuts, rules }: StyleScopeOptions): Promise<SharedScopedUnoRuntime> => {
  const scopeSelector = `.${scopeClass}`;
  // preflightRoot is owned by the scope: caller-provided theme.preflightRoot is intentionally overridden.
  const preflightRoot = [scopeSelector, `${scopeSelector} *`, `${scopeSelector}::before`, `${scopeSelector}::after`, `${scopeSelector} *::before`, `${scopeSelector} *::after`, `${scopeSelector}::backdrop`];
  const [{ createGenerator }, { default: presetWind3 }, { presetAnimations }] = await Promise.all([import("@unocss/core"), import("@unocss/preset-wind3"), import("unocss-preset-animations")]);
  const generator = await createGenerator({ theme: { ...theme, preflightRoot }, shortcuts, rules, presets: [presetWind3({ dark: "class", important: scopeSelector, preflight: "on-demand" }), presetAnimations()] });
  const tokens = new Set<string>();
  const styles = new Map<string, HTMLStyleElement>();
  let activeObserverCount = 0;
  let retainedScopeCount = 0;
  let runtimeVersion = 0;
  let updateQueued = false;
  let updateResolvers: Array<() => void> = [];
  const decodeHtml = (html: string) => {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = html;
    return textarea.value;
  };
  const getStyle = (layer: string, previousLayer?: string) => {
    let style = styles.get(layer);
    if (style) return style;
    style = document.createElement("style");
    style.dataset.unocssRuntimeLayer = layer;
    style.setAttribute(SCOPED_UNO_STYLE_ATTR, "true");
    styles.set(layer, style);
    const previousStyle = previousLayer ? styles.get(previousLayer) : null;
    if (previousStyle?.parentNode) previousStyle.parentNode.insertBefore(style, previousStyle.nextSibling);
    else document.head.append(style);
    return style;
  };
  const clearRuntime = () => {
    runtimeVersion += 1;
    updateQueued = false;
    const resolvers = updateResolvers;
    updateResolvers = [];
    for (const resolver of resolvers) resolver();
    for (const style of styles.values()) style.remove();
    styles.clear();
    tokens.clear();
  };
  const update = async () => {
    const version = runtimeVersion;
    const result = await generator.generate([...tokens], { preflights: true });
    if (version !== runtimeVersion) return;
    result.layers.reduce<string | undefined>((previousLayer, layer) => {
      const style = getStyle(layer, previousLayer);
      const css = result.getLayer(layer) ?? "";
      if (style.textContent !== css) style.textContent = css;
      return layer;
    }, undefined);
    for (const token of tokens) if (!result.matched.has(token)) tokens.delete(token);
  };
  const scheduleUpdate = () =>
    new Promise<void>((resolve) => {
      updateResolvers.push(resolve);
      if (updateQueued) return;
      updateQueued = true;
      queueMicrotask(() => {
        updateQueued = false;
        void update().finally(() => {
          const resolvers = updateResolvers;
          updateResolvers = [];
          for (const resolver of resolvers) resolver();
        });
      });
    });
  const extract = async (source: string) => {
    const size = tokens.size;
    await generator.applyExtractors(source, undefined, tokens);
    if (size !== tokens.size) await scheduleUpdate();
  };
  const extractAll = async (target: Element) => {
    const html = target.outerHTML;
    if (html) await extract(`${html} ${decodeHtml(html)}`);
  };
  return {
    retain() {
      retainedScopeCount += 1;
      return () => {
        retainedScopeCount -= 1;
        if (!activeObserverCount && !retainedScopeCount) clearRuntime();
      };
    },
    extract,
    async observe(root) {
      activeObserverCount += 1;
      let destroyed = false;
      let extractQueued = false;
      const runExtract = () => {
        extractQueued = false;
        if (!destroyed) void extractAll(root);
      };
      const scheduleExtract = () => {
        if (extractQueued) return;
        extractQueued = true;
        queueMicrotask(runExtract);
      };
      const observer = new MutationObserver(scheduleExtract);
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "className"] });
      await extractAll(root);
      return {
        destroy() {
          if (destroyed) return;
          destroyed = true;
          observer.disconnect();
          activeObserverCount -= 1;
          if (!activeObserverCount && !retainedScopeCount) clearRuntime();
        },
      };
    },
  };
};

export function createStyleScope(options: StyleScopeOptions) {
  let sharedScopedUnoRuntimePromise: Promise<SharedScopedUnoRuntime> | null = null;
  const getSharedScopedUnoRuntime = () =>
    (sharedScopedUnoRuntimePromise ??= createSharedScopedUnoRuntime(options).catch((error) => {
      sharedScopedUnoRuntimePromise = null;
      throw error;
    }));
  const createScopedUnoController = async (root: Element): Promise<ScopedUnoController> => (await getSharedScopedUnoRuntime()).observe(root);
  const primeScopedUnoCSS = async (code: string) => (await getSharedScopedUnoRuntime()).extract(code);
  const retainScopedUnoRuntime = async () => (await getSharedScopedUnoRuntime()).retain();

  function StyleScope({ active = true, code = "", children }: StyleScopeProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const mountedRef = useRef(false);
    const retainingRef = useRef(false);
    const releaseRuntimeRef = useRef<(() => void) | null>(null);
    const retainRuntime = useCallback(() => {
      if (retainingRef.current || releaseRuntimeRef.current) return;
      retainingRef.current = true;
      void retainScopedUnoRuntime().then(
        (release) => {
          retainingRef.current = false;
          if (!mountedRef.current) {
            release();
            return;
          }
          releaseRuntimeRef.current = release;
        },
        (error) => {
          retainingRef.current = false;
          console.error("[genui] scoped UnoCSS retain failed", error);
        },
      );
    }, []);
    const prime = useCallback(
      async (nextCode: string) => {
        if (!active || !nextCode.trim()) return;
        retainRuntime();
        await primeScopedUnoCSS(nextCode).catch((error) => console.error("[genui] scoped UnoCSS prime failed", error));
      },
      [active, retainRuntime],
    );
    const contextValue = useMemo(() => ({ prime }), [prime]);
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        releaseRuntimeRef.current?.();
        releaseRuntimeRef.current = null;
      };
    }, []);
    useEffect(() => {
      void prime(code);
    }, [code, prime]);
    useEffect(() => {
      if (!active) return;
      retainRuntime();
      let cancelled = false;
      let controller: ScopedUnoController | null = null;
      void (async () => {
        const root = rootRef.current;
        if (!root) return;
        const nextController = await createScopedUnoController(root);
        if (cancelled) {
          nextController.destroy();
          return;
        }
        controller = nextController;
      })().catch((error) => console.error("[genui] scoped UnoCSS init failed", error));
      return () => {
        cancelled = true;
        controller?.destroy();
      };
    }, [active, retainRuntime]);
    return (
      <StyleScopeContext.Provider value={contextValue}>
        <div ref={rootRef} className={options.scopeClass}>
          {children}
        </div>
      </StyleScopeContext.Provider>
    );
  }

  return StyleScope;
}
