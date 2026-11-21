import { describe, expect, it } from "vitest";
import { IDENTITY_TRANSFORM } from "../project.geometry";
import { seedProject } from "../project.testing";
import type { ClipMask } from "../project.types";
import { maskProblem } from "./fields.masks";
import { maskOutline, maskPlacement } from "./mask";

function mask(shape: ClipMask["shape"], over: Partial<ClipMask> = {}): ClipMask {
  return {
    id: "m",
    name: "Mask 1",
    color: "orange",
    mode: "add",
    opacity: 1,
    feather: 0,
    expansion: 0,
    x: 0,
    y: 0,
    rotation: 0,
    shape,
    ...over,
  };
}

describe("masks", () => {
  it("refuses a mask order naming a prototype property", () => {
    const clip = {
      id: "a",
      kind: "text",
      trackId: "v1",
      start: 0,
      sourceIn: 0,
      duration: 10,
      props: {},
      masks: { m: mask({ kind: "ellipse", width: 10, height: 10 }) },
    };
    const state = seedProject({ clips: { a: { ...clip, maskOrder: ["constructor"] } } });
    expect(maskProblem(state)).toBe("a clip's mask order would not match its masks");
    const keyed = seedProject({
      clips: { a: { ...clip, maskOrder: ["m"], masks: { x: clip.masks.m } } },
    });
    expect(maskProblem(keyed)).not.toBeNull();
  });

  it("maps the fitted picture to the frame regardless of pixel count", () => {
    const f = { width: 1920, height: 1080, fps: 30 };
    const t = { ...IDENTITY_TRANSFORM, scale: 2, scaleX: -1 };
    expect(maskPlacement(f, { width: 960, height: 540 }, t)).toEqual(
      maskPlacement(f, { width: 3840, height: 2160 }, t),
    );
    expect(maskPlacement(f, { width: 960, height: 540 }, t)).toMatchObject({ sx: -2, sy: 2 });
  });

  it("outlines an ellipse through its four extremes", () => {
    const segments = maskOutline(
      mask({ kind: "ellipse", width: 100, height: 50 }, { x: 10, y: 20 }),
    )!;
    const ends = segments.map((s) => [Math.round(s[3].x), Math.round(s[3].y)]);
    expect(ends).toHaveLength(4);
    for (const end of [
      [60, 20],
      [10, 45],
      [-40, 20],
      [10, -5],
    ])
      expect(ends).toContainEqual(end);
  });
});
