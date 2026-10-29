import { describe, expect, it } from "vitest";
import { patchSchema } from "@/modules/element";
import type { ProjectFormat } from "@/modules/project";
import { builtInPresets } from "./presets";

const format = { width: 1080, height: 1920 } as ProjectFormat;

describe("builtInPresets", () => {
  it("has the seven ids", () => {
    expect(builtInPresets.map((p) => p.id)).toEqual([
      "fade",
      "cross-dissolve",
      "dissolve",
      "wipe",
      "glare",
      "woosh",
      "glitch",
    ]);
  });
  for (const preset of builtInPresets) {
    it(`${preset.id}: defaults parse with its own schema`, () => {
      const schema = patchSchema(preset.properties, { propType: () => undefined, groups: [] });
      expect(schema.safeParse(preset.defaults(format)).success).toBe(true);
    });
  }
});
