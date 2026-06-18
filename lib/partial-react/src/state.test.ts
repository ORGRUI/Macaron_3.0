import { describe, expect, test } from "bun:test";
import { Component, createElement, isValidElement, type ReactElement } from "react";
import { createGeneratedComponentSlot } from "./state";

describe("createGeneratedComponentSlot", () => {
  test("keeps a stable wrapper while swapping implementations", () => {
    const slot = createGeneratedComponentSlot();
    const first = () => "first";
    const second = () => "second";
    slot.setCurrent(first);
    const wrapper = slot.Component;
    expect(wrapper({})).toBe("first");
    slot.setCurrent(second);
    expect(slot.Component).toBe(wrapper);
    expect(wrapper({})).toBe("second");
  });

  test("does not expose swapped function implementations as changing element types", () => {
    const slot = createGeneratedComponentSlot();
    const first = () => createElement("button", null, "first");
    const second = () => createElement("button", null, "second");
    slot.setCurrent(first);
    const wrapper = slot.Component;
    const firstElement = wrapper({});
    expect(isValidElement(firstElement)).toBe(true);
    expect((firstElement as ReactElement).type).toBe("button");
    slot.setCurrent(second);
    const secondElement = wrapper({});
    expect(isValidElement(secondElement)).toBe(true);
    expect((secondElement as ReactElement).type).toBe("button");
  });

  test("falls back to the last good component after a render error", () => {
    const slot = createGeneratedComponentSlot();
    const good = () => "good";
    const bad = () => {
      throw new Error("boom");
    };
    slot.setCurrent(good);
    slot.markRendered(good);
    slot.setCurrent(bad);
    expect(slot.restoreLastGood()).toBe(true);
    expect(slot.Component({})).toBe("good");
  });

  test("clears both current and last good components", () => {
    const slot = createGeneratedComponentSlot();
    const good = () => "good";
    slot.setCurrent(good);
    slot.markRendered(good);
    slot.clear();
    expect(slot.current()).toBeNull();
    expect(slot.lastGood()).toBeNull();
    expect(slot.restoreLastGood()).toBe(false);
  });

  test("renders class components through React instead of invoking them", () => {
    class Card extends Component {
      render() {
        return "card";
      }
    }
    const slot = createGeneratedComponentSlot();
    slot.setCurrent(Card);
    const element = slot.Component({});
    expect(isValidElement(element)).toBe(true);
    expect((element as ReactElement).type).toBe(Card);
  });
});
