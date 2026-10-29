import { Scissors } from "lucide-react";
import { describe, expect, it } from "vitest";
import { createEmptyProject, type Clip } from "@/modules/project";
import { defineJunctionKind } from "./define";
import { clampDuration, durationLimits } from "./limits";

const S = 1_000_000;

const clip = (id: string, start: number, duration: number): Clip => ({
  id,
  trackId: "t",
  kind: "media",
  props: {},
  start,
  sourceIn: 0,
  duration,
});

const kind = defineJunctionKind({
  kind: "test.fade",
  name: "Fade",
  icon: Scissors,
  tracks: ["video"],
  properties: {},
  defaults: () => ({}),
  overlap: {
    default: 500_000,
    min: (state) => Math.ceil(S / state.format.fps),
    max: (l, r) => Math.floor(Math.min(l.duration, r.duration) / 2),
  },
});

describe("durationLimits", () => {
  const state = createEmptyProject();
  state.format.fps = 30;

  it("limits: max is half the shorter clip", () => {
    const l = durationLimits(kind, state, clip("a", 0, 4 * S), clip("b", 4 * S, 3 * S));
    expect(l.max).toBe(1_500_000);
  });

  it("limits: min is one frame at 30 fps", () => {
    const l = durationLimits(kind, state, clip("a", 0, 4 * S), clip("b", 4 * S, 3 * S));
    expect(l.min).toBe(33_334);
  });

  it("limits: default 500_000 is clamped to max", () => {
    const l = durationLimits(kind, state, clip("a", 0, 600_000), clip("b", 600_000, 600_000));
    expect(l).toEqual({ min: 33_334, max: 300_000, default: 300_000 });
  });

  it("returns zeros when the kind doesn't overlap", () => {
    const none = defineJunctionKind({ ...kind, overlap: false });
    expect(durationLimits(none, state, clip("a", 0, S), clip("b", S, S))).toEqual({
      min: 0,
      max: 0,
      default: 0,
    });
  });

  it("clampDuration keeps d within the limits", () => {
    const limits = { min: 10, max: 100, default: 50 };
    expect(clampDuration(5, limits)).toBe(10);
    expect(clampDuration(500, limits)).toBe(100);
    expect(clampDuration(60, limits)).toBe(60);
  });
});
