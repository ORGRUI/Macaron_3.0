import { describe, expect, test } from "bun:test";
import { createElement, Fragment, useId } from "react";
import { renderToString } from "react-dom/server";
import { GenUIRenderContext, getGenUIRenderContextValue } from "./renderContext";

const extractRenderedId = (html: string) => html.match(/data-id="([^"]+)"/)?.[1];
const IdProbe = ({ id }: { id?: string }) => {
  const fallbackId = useId();
  return createElement("span", { "data-id": id ?? fallbackId });
};

describe("GenUIRenderContext", () => {
  test("is shared through a global symbol so GenUI chunks read the renderer provider", () => {
    const globalRenderContext = globalThis as typeof globalThis & Record<symbol, unknown>;
    expect(globalRenderContext[Symbol.for("@macaron/genui-runtime:render-context")]).toBe(GenUIRenderContext);
  });

  test("uses stable values when the streaming flag is unchanged", () => {
    expect(getGenUIRenderContextValue(false)).toBe(getGenUIRenderContextValue(false));
    expect(getGenUIRenderContextValue(true)).toBe(getGenUIRenderContextValue(true));
    expect(getGenUIRenderContextValue(false)).not.toBe(getGenUIRenderContextValue(true));
    expect(getGenUIRenderContextValue(false, "renderer-a")).toBe(getGenUIRenderContextValue(false, "renderer-a"));
    expect(getGenUIRenderContextValue(false, "renderer-a")).not.toBe(getGenUIRenderContextValue(false, "renderer-b"));
  });

  test("provides stable fallback keys where useId shifts with streamed siblings", () => {
    const withUseId = (trailingSiblings: number) => renderToString(createElement(Fragment, null, createElement(IdProbe), ...Array.from({ length: trailingSiblings }, (_, index) => createElement("div", { key: index }))));
    expect(extractRenderedId(withUseId(0))).not.toBe(extractRenderedId(withUseId(1)));

    const context = getGenUIRenderContextValue(true, "renderer-a", () => "chart-0");
    const withAllocator = (trailingSiblings: number) => renderToString(createElement(Fragment, null, createElement(IdProbe, { id: context.nextStreamingRenderKey?.() }), ...Array.from({ length: trailingSiblings }, (_, index) => createElement("div", { key: index }))));
    expect(extractRenderedId(withAllocator(0))).toBe("chart-0");
    expect(extractRenderedId(withAllocator(1))).toBe("chart-0");
  });
});
