import { describe, expect, it } from "vitest";
import { createEmptyProject, type ProjectState } from "@/modules/project";
import { clampTrim, findOverlap, neighbourBounds, snapSpan, snapTime, trackEnd } from "./placement";

const S = 1_000_000;

function projectWithClips(spans: Array<[number, number]>): {
  state: ProjectState;
  trackId: string;
} {
  const state = createEmptyProject();
  const trackId = state.trackOrder[0]!;
  spans.forEach(([start, duration], i) => {
    const id = `c${i}`;
    state.clips[id] = { id, trackId, mediaId: "m", start, sourceIn: 0, duration };
    state.tracks[trackId]!.clipIds.push(id);
  });
  return { state, trackId };
}

describe("findOverlap", () => {
  const { state, trackId } = projectWithClips([
    [0, 2 * S],
    [5 * S, 2 * S],
  ]);

  it("detects overlaps and allows touching edges", () => {
    expect(findOverlap(state, trackId, S, S)?.id).toBe("c0");
    expect(findOverlap(state, trackId, 2 * S, 3 * S)).toBeUndefined();
    expect(findOverlap(state, trackId, 4 * S, 2 * S)?.id).toBe("c1");
  });

  it("ignores the given clips", () => {
    expect(findOverlap(state, trackId, S, S, new Set(["c0"]))).toBeUndefined();
  });

  it("computes the track end", () => {
    expect(trackEnd(state, trackId)).toBe(7 * S);
  });
});

describe("clampTrim", () => {
  const limits = { mediaDuration: 10 * S, minDuration: 100_000, prevEnd: 0, nextStart: Infinity };

  it("trims the start and shifts the source in-point", () => {
    const clip = { start: 2 * S, sourceIn: 1 * S, duration: 4 * S };
    expect(clampTrim(clip, "start", 3 * S, limits)).toEqual({
      start: 3 * S,
      sourceIn: 2 * S,
      duration: 3 * S,
    });
  });

  it("cannot extend the start before the source begins", () => {
    const clip = { start: 2 * S, sourceIn: 1 * S, duration: 4 * S };
    expect(clampTrim(clip, "start", 0, limits)).toEqual({ start: S, sourceIn: 0, duration: 5 * S });
  });

  it("cannot extend the end past the source or into the next clip", () => {
    const clip = { start: 0, sourceIn: 8 * S, duration: S };
    expect(clampTrim(clip, "end", 5 * S, limits).duration).toBe(2 * S);
    expect(clampTrim(clip, "end", 5 * S, { ...limits, nextStart: 1.5 * S }).duration).toBe(1.5 * S);
  });

  it("keeps a minimum length", () => {
    const clip = { start: 0, sourceIn: 0, duration: S };
    expect(clampTrim(clip, "end", -5 * S, limits).duration).toBe(100_000);
    expect(clampTrim(clip, "start", 5 * S, limits).duration).toBe(100_000);
  });

  it("stops at the previous clip", () => {
    const { state } = projectWithClips([
      [0, 2 * S],
      [3 * S, 2 * S],
    ]);
    const clip = state.clips.c1!;
    const bounds = neighbourBounds(state, clip);
    expect(bounds).toEqual({ prevEnd: 2 * S, nextStart: Infinity });
    const trimmed = clampTrim({ ...clip, sourceIn: 5 * S }, "start", 0, { ...limits, ...bounds });
    expect(trimmed.start).toBe(2 * S);
  });
});

describe("snapping", () => {
  it("snaps to the closest candidate within the threshold", () => {
    expect(snapTime(1_050_000, [0, S, 2 * S], 100_000)).toBe(S);
    expect(snapTime(1_500_000, [0, S, 2 * S], 100_000)).toBe(1_500_000);
  });

  it("snaps a span by its end edge when that is closer", () => {
    expect(snapSpan(500_000, S, [1_520_000], 50_000)).toBe(520_000);
    expect(snapSpan(500_000, S, [490_000, 1_520_000], 50_000)).toBe(490_000);
  });
});
