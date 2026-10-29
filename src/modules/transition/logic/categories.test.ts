import { describe, expect, it } from "vitest";
import type { TransitionPresetDefinition } from "../transition.types";
import { orderCategories } from "./categories";

const preset = (id: string, category: string) => ({ id, category }) as TransitionPresetDefinition;

describe("orderCategories", () => {
  it("lists known categories in order, then others by name", () => {
    const sections = orderCategories([
      preset("a", "zoom"),
      preset("b", "glitch"),
      preset("c", "basic"),
      preset("d", "blur"),
      preset("e", "arc"),
      preset("f", "overlay"),
    ]);
    expect(sections.map((s) => s.category)).toEqual([
      "basic",
      "overlay",
      "blur",
      "glitch",
      "arc",
      "zoom",
    ]);
  });
  it("keeps contribution order inside a section and capitalizes the title", () => {
    const [section] = orderCategories([preset("x", "basic"), preset("y", "basic")]);
    expect(section?.presets.map((p) => p.id)).toEqual(["x", "y"]);
    expect(section?.title).toBe("Basic");
  });
  it("returns nothing for no presets", () => {
    expect(orderCategories([])).toEqual([]);
  });
});
