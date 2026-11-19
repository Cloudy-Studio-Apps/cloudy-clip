import { describe, expect, it } from "vitest";
import type { Clip, ClipTransform } from "./project.types";
import {
  clipPlacement,
  clipTransform,
  IDENTITY_TRANSFORM,
  normalizeRotation,
} from "./project.geometry";

const vertical = { width: 1080, height: 1920, fps: 30 };

describe("clipPlacement", () => {
  it("fits and centers an untransformed picture", () => {
    const placement = clipPlacement(vertical, { width: 1920, height: 1080 }, IDENTITY_TRANSFORM);
    expect(placement).toEqual({
      cx: 540,
      cy: 960,
      width: 1080,
      height: 607.5,
      rotation: 0,
      flipX: false,
      flipY: false,
    });
  });

  it("applies offset, scale and rotation", () => {
    const placement = clipPlacement(
      vertical,
      { width: 1080, height: 1920 },
      { ...IDENTITY_TRANSFORM, x: 100, y: -50, scale: 0.5, rotation: 30 },
    );
    expect(placement).toEqual({
      cx: 640,
      cy: 910,
      width: 540,
      height: 960,
      rotation: 30,
      flipX: false,
      flipY: false,
    });
  });
});

describe("clipPlacement without fitting", () => {
  it("keeps the natural size (text)", () => {
    const placement = clipPlacement(
      vertical,
      { width: 200, height: 100 },
      { ...IDENTITY_TRANSFORM, scale: 2 },
      "none",
    );
    expect(placement).toEqual({
      cx: 540,
      cy: 960,
      width: 400,
      height: 200,
      rotation: 0,
      flipX: false,
      flipY: false,
    });
  });
});

describe("clipPlacement with pivot, stretch and flip", () => {
  const square = { width: 1000, height: 1000, fps: 30 };
  const src = { width: 1000, height: 1000 };
  const t = (patch: Partial<ClipTransform>): ClipTransform => ({ ...IDENTITY_TRANSFORM, ...patch });

  it("stretches each axis on its own", () => {
    expect(clipPlacement(square, src, t({ scaleX: 1.5, scaleY: 0.5 }))).toMatchObject({
      width: 1500,
      height: 500,
      flipX: false,
      flipY: false,
    });
  });

  it("flips with a negative factor and keeps sizes positive", () => {
    expect(clipPlacement(square, src, t({ scaleX: -1, scaleY: -2 }))).toMatchObject({
      width: 1000,
      height: 2000,
      flipX: true,
      flipY: true,
    });
  });

  it("puts the pivot at x/y: a left-edge pivot shifts the picture right", () => {
    expect(clipPlacement(square, src, t({ pivotX: -0.5 }))).toMatchObject({ cx: 1000, cy: 500 });
  });

  it("keeps the pivot fixed when rotating", () => {
    const p = clipPlacement(square, src, t({ pivotX: -0.5, rotation: 90 }));
    expect(p.cx).toBeCloseTo(500);
    expect(p.cy).toBeCloseTo(1000);
  });

  it("mirrors the pivot with the flip", () => {
    expect(clipPlacement(square, src, t({ pivotX: -0.5, scaleX: -1 }))).toMatchObject({ cx: 0 });
  });

  it("zero width places a zero-size picture", () => {
    expect(clipPlacement(square, src, t({ scaleX: 0, pivotX: 0.3 }))).toMatchObject({
      width: 0,
      cx: 500,
    });
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

describe("clipTransform", () => {
  const clip = { id: "c", kind: "media", props: {} } as unknown as Clip;
  it("merges a live patch over the saved transform", () => {
    const saved = { ...clip, transform: { ...IDENTITY_TRANSFORM, x: 5, scale: 2 } };
    expect(clipTransform(saved, { scale: 3 })).toEqual({
      ...IDENTITY_TRANSFORM,
      x: 5,
      scale: 3,
    });
  });
  it("merges a live patch over the identity", () => {
    expect(clipTransform(clip, { x: 4 })).toEqual({ ...IDENTITY_TRANSFORM, x: 4 });
  });
});
