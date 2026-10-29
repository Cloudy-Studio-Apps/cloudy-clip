import { describe, expect, it } from "vitest";
import { clipPlacement, IDENTITY_TRANSFORM, normalizeRotation } from "./project.geometry";

const vertical = { width: 1080, height: 1920, fps: 30 };

describe("clipPlacement", () => {
  it("fits and centers an untransformed picture", () => {
    const placement = clipPlacement(vertical, { width: 1920, height: 1080 }, IDENTITY_TRANSFORM);
    expect(placement).toEqual({ cx: 540, cy: 960, width: 1080, height: 607.5, rotation: 0 });
  });

  it("applies offset, scale and rotation", () => {
    const placement = clipPlacement(
      vertical,
      { width: 1080, height: 1920 },
      { x: 100, y: -50, scale: 0.5, rotation: 30 },
    );
    expect(placement).toEqual({ cx: 640, cy: 910, width: 540, height: 960, rotation: 30 });
  });
});

describe("clipPlacement without fitting", () => {
  it("keeps the natural size (text)", () => {
    const placement = clipPlacement(
      vertical,
      { width: 200, height: 100 },
      { x: 0, y: 0, scale: 2, rotation: 0 },
      "none",
    );
    expect(placement).toEqual({ cx: 540, cy: 960, width: 400, height: 200, rotation: 0 });
  });
});

describe("normalizeRotation", () => {
  it("keeps angles in (-180, 180]", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(190)).toBe(-170);
    expect(normalizeRotation(-180)).toBe(180);
    expect(normalizeRotation(540)).toBe(180);
    expect(normalizeRotation(-725)).toBe(-5);
  });
});
