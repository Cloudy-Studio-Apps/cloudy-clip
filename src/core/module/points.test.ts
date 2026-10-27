import { describe, expect, it } from "vitest";
import { createPointRegistry, definePoint } from "./points";

interface Panel {
  id: string;
}

const panels = definePoint<Panel>("panel", { keyOf: (panel) => panel.id });
const words = definePoint<string>("words");

describe("points", () => {
  it("returns contributions in contribution order", () => {
    const registry = createPointRegistry();
    registry.add(words, "a", ["a", "b"]);
    registry.add(words, "b", ["c"]);
    expect(registry.get(words)).toEqual(["a", "b", "c"]);
  });

  it("returns the same array until the point changes", () => {
    const registry = createPointRegistry();
    registry.add(words, "a", ["a"]);
    const first = registry.get(words);
    expect(registry.get(words)).toBe(first);
    registry.add(words, "b", ["b"]);
    expect(registry.get(words)).not.toBe(first);
  });

  it("rejects a duplicate key and names both modules", () => {
    const registry = createPointRegistry();
    registry.add(panels, "media", [{ id: "x" }]);
    expect(() => registry.add(panels, "timeline", [{ id: "x" }])).toThrow(
      /panel.*media.*timeline|panel.*timeline.*media/s,
    );
    expect(() => registry.add(panels, "timeline", [{ id: "x" }])).toThrow(/media/);
  });

  it("find looks up by key", () => {
    const registry = createPointRegistry();
    registry.add(panels, "media", [{ id: "x" }]);
    expect(registry.find(panels, "x")?.id).toBe("x");
    expect(registry.find(panels, "missing")).toBeUndefined();
  });

  it("disposing removes only that contribution", () => {
    const registry = createPointRegistry();
    const dispose = registry.add(words, "a", ["a"]);
    registry.add(words, "b", ["b"]);
    dispose();
    expect(registry.get(words)).toEqual(["b"]);
  });

  it("notifies subscribers on add and dispose", () => {
    const registry = createPointRegistry();
    let calls = 0;
    registry.subscribe(() => calls++);
    const dispose = registry.add(words, "a", ["a"]);
    dispose();
    expect(calls).toBe(2);
  });
});
