import { describe, expect, it } from "vitest";
import type { TextPresetId } from "../text.types";
import { presetStyle, presetTransform } from "./presets";

const format = { width: 1080, height: 1920, fps: 30 };
const ids: TextPresetId[] = ["title", "highlight", "outline", "pop", "lower-third"];

describe("presets", () => {
  it("sizes the title from the short side", () => {
    expect(presetStyle("title", format).size).toBe(97);
  });

  it("places only the lower third", () => {
    expect(presetTransform("lower-third", format)).toEqual({
      x: -216,
      y: 614.4,
      scale: 1,
      rotation: 0,
    });
    for (const id of ids.filter((i) => i !== "lower-third")) {
      expect(presetTransform(id, format)).toBeNull();
    }
  });

  it("rounds sizes to integers", () => {
    for (const id of ids) expect(Number.isInteger(presetStyle(id, format).size)).toBe(true);
  });

  it("describes the outline and highlight looks", () => {
    expect(presetStyle("outline", format).outline).toEqual({
      enabled: true,
      color: "#000000",
      width: Math.round(0.008 * 1080),
    });
    expect(presetStyle("highlight", format).background?.enabled).toBe(true);
    expect(presetStyle("lower-third", format).align).toBe("left");
  });
});
