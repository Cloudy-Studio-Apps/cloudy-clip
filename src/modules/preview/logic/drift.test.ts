import { describe, expect, it } from "vitest";
import type { DriftState } from "../preview.types";
import { MAX_SEEK_AHEAD, driftSeek } from "./drift";

/** An element on the clock at 10 s, no seek in flight, the last one long ago. */
function state(patch: Partial<DriftState> = {}): DriftState {
  return {
    current: 10,
    desired: 10,
    duration: 60,
    seekTarget: null,
    sinceSeekMs: 10_000,
    seekCost: 0.2,
    ...patch,
  };
}

describe("driftSeek", () => {
  it("leaves an element on the clock alone", () => {
    expect(driftSeek(state({ current: 9.95 }))).toBeNull();
  });

  it("aims where the clock will be when the seek lands, not where it is now", () => {
    expect(driftSeek(state({ current: 9.5 }))).toBeCloseTo(10.2);
  });

  it("converges: a seek that took as long as predicted needs no second one", () => {
    const target = driftSeek(state({ current: 9.5 }));
    // The seek took its 0.2 s: the clock and the element meet at the target.
    expect(
      driftSeek(state({ current: target!, desired: 10.2, sinceSeekMs: 200, seekTarget: null })),
    ).toBeNull();
  });

  it("does not trust a seek cost beyond the cap", () => {
    expect(driftSeek(state({ current: 9.5, seekCost: 5 }))).toBeCloseTo(10 + MAX_SEEK_AHEAD);
  });

  it("does not aim past the end of the file (an ended element restarts on play)", () => {
    expect(driftSeek(state({ current: 59.5, desired: 59.9, duration: 60 }))).toBe(59.9);
  });

  it("aims at the clock while the duration is unknown", () => {
    expect(driftSeek(state({ current: 9.5, duration: Number.NaN }))).toBe(10);
  });

  it("gives a fresh seek time to land", () => {
    expect(driftSeek(state({ current: 9.7, sinceSeekMs: 100 }))).toBeNull();
    expect(driftSeek(state({ current: 9.2, sinceSeekMs: 100 }))).toBeCloseTo(10.2);
  });

  it("does not repeat a seek in flight, even one aimed ahead of the clock", () => {
    expect(driftSeek(state({ current: 9, seekTarget: 10.2 }))).toBeNull();
  });

  it("replaces a seek in flight the clock has left behind", () => {
    expect(driftSeek(state({ current: 5, seekTarget: 5.2 }))).toBeCloseTo(10.2);
    expect(driftSeek(state({ current: 5, seekTarget: 30 }))).toBeCloseTo(10.2);
  });
});
