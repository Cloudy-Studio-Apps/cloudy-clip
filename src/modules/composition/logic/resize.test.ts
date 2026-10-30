import { describe, expect, it } from "vitest";
import type { ClipTransform } from "@/modules/project";
import { scaleTransform } from "./resize";

const vertical = { width: 1080, height: 1920, fps: 30 };
const landscape = { width: 1920, height: 1080, fps: 30 };
const t = (over: Partial<ClipTransform> = {}): ClipTransform => ({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  ...over,
});

describe("scaleTransform", () => {
  it("keeps a contain picture's scale, and maps its offset by each axis", () => {
    expect(scaleTransform(t({ x: 100, y: 200, scale: 2 }), "contain", vertical, landscape)).toEqual(
      t({ x: 100 * (1920 / 1080), y: 200 * (1080 / 1920), scale: 2 }),
    );
  });

  it("scales a fit none picture by the smaller ratio", () => {
    expect(scaleTransform(t(), "none", vertical, landscape).scale).toBe(1080 / 1920);
  });

  it("does nothing at the same size", () => {
    expect(scaleTransform(t({ x: 5 }), "none", vertical, vertical)).toEqual(t({ x: 5 }));
  });
});
