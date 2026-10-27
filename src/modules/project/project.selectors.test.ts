import { describe, expect, it } from "vitest";
import { FORMAT_PRESETS } from "./project.store";
import { formatPreset } from "./project.selectors";

describe("formatPreset", () => {
  it("names every preset's own format", () => {
    for (const [name, format] of Object.entries(FORMAT_PRESETS)) {
      expect(formatPreset(format)).toBe(name);
    }
  });

  it("goes by aspect ratio for other sizes", () => {
    expect(formatPreset({ width: 720, height: 1280, fps: 30 })).toBe("9:16");
    expect(formatPreset({ width: 3840, height: 2160, fps: 60 })).toBe("16:9");
  });
});
