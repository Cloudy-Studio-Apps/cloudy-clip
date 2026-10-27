import { describe, expect, it } from "vitest";
import { defineModule, defineModuleRef } from "./define-module";
import { orderModules } from "./module-order";
import type { AnyModuleDefinition } from "./module.types";

function mod(
  id: string,
  deps: { requires?: string[]; uses?: string[]; after?: string[] } = {},
): AnyModuleDefinition {
  return defineModule({ ref: defineModuleRef(id), name: id, ...deps });
}

const ids = (modules: readonly AnyModuleDefinition[]) => modules.map((m) => m.ref.id);

describe("orderModules", () => {
  it("orders by requires regardless of input order", () => {
    const { order } = orderModules(
      [mod("c", { requires: ["b"] }), mod("b", { requires: ["a"] }), mod("a")],
      new Set(),
    );
    expect(ids(order)).toEqual(["a", "b", "c"]);
  });

  it("after only orders and does not require", () => {
    const { order, skipped } = orderModules(
      [mod("y", { after: ["x"] }), mod("x"), mod("z", { after: ["missing"] })],
      new Set(),
    );
    expect(ids(order)).toEqual(["x", "y", "z"]);
    expect(skipped).toEqual({});
  });

  it("uses must be present but does not order", () => {
    const { order, skipped } = orderModules([mod("er", { uses: ["db"] })], new Set());
    expect(order).toEqual([]);
    expect(skipped.er).toMatch(/db/);
  });

  it("skips modules whose requirement is skipped", () => {
    const { order, skipped } = orderModules(
      [mod("a", { requires: ["missing"] }), mod("b", { requires: ["a"] })],
      new Set(),
    );
    expect(order).toEqual([]);
    expect(Object.keys(skipped).sort()).toEqual(["a", "b"]);
  });

  it("throws on a requires cycle and names the modules", () => {
    expect(() =>
      orderModules([mod("a", { requires: ["b"] }), mod("b", { requires: ["a"] })], new Set()),
    ).toThrow(/a.*b|b.*a/);
  });

  it("already loaded modules satisfy requires", () => {
    const { order } = orderModules([mod("media", { requires: ["project"] })], new Set(["project"]));
    expect(ids(order)).toEqual(["media"]);
  });

  it("orders uses before the module when possible", () => {
    const { order } = orderModules([mod("a", { uses: ["b"] }), mod("b")], new Set());
    expect(ids(order)).toEqual(["b", "a"]);
  });

  it("mutual uses is not a cycle", () => {
    const { order } = orderModules(
      [mod("a", { uses: ["b"] }), mod("b", { uses: ["a"] })],
      new Set(),
    );
    expect(ids(order).sort()).toEqual(["a", "b"]);
  });

  it("loads feature modules after the core modules of the batch", () => {
    const feature = defineModule({ ref: defineModuleRef("f"), name: "f", tier: "feature" });
    const core = defineModule({ ref: defineModuleRef("c"), name: "c", tier: "core" });
    expect(ids(orderModules([feature, core], new Set()).order)).toEqual(["c", "f"]);
  });
});
