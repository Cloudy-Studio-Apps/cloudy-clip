import { describe, expect, it } from "vitest";
import type { Clip, KeyTrack } from "../project.types";
import { animatedClip } from "./animate";
import { contentTime, rateAt, timeOfContent } from "./content";
import { RAMP_PATH, rampContentAt, rampTimeAt } from "./ramp";
import { sameSpeed, sourceSpan, sourceTimeAt, speedOf } from "./speed";

const S = 1_000_000;

const ramp: KeyTrack = {
  blend: "number",
  shared: true,
  min: 0.1,
  max: 10,
  keys: [
    { id: "a", t: 0, value: 1 },
    { id: "b", t: 2 * S, value: 4 },
  ],
};

const clip: Clip = {
  id: "c",
  trackId: "v",
  kind: "media",
  props: {},
  start: 10 * S,
  sourceIn: 5 * S,
  duration: 2 * S,
  animation: { [RAMP_PATH]: ramp },
};

describe("the ramp table", () => {
  it("plays a constant part at its rate", () =>
    expect(rampTimeAt(ramp, 2 * S, 6 * S)).toBeCloseTo(S, -3));

  it("inverts", () => {
    const taken = rampTimeAt(ramp, 0, 3 * S);
    expect(rampContentAt(ramp, 0, taken)).toBeCloseTo(3 * S, -3);
  });

  it("takes less time than the slowest rate would", () =>
    expect(rampTimeAt(ramp, 0, 2 * S)).toBeLessThan(2 * S));

  it("steps exactly where a held key changes", () => {
    const held: KeyTrack = {
      blend: "number",
      keys: [
        { id: "a", t: 0, value: 2, ease: { kind: "hold" } },
        { id: "b", t: S / 1000, value: 10 },
      ],
    };
    expect(rampTimeAt(held, 0, S / 1000)).toBe(S / 2000);
  });
});

describe("a ramped clip", () => {
  it("reads the file through the ramp", () => {
    const taken = rampTimeAt(ramp, 0, S);
    expect(sourceTimeAt(clip, clip.start + taken)).toBeCloseTo(5 * S + S, -2);
  });

  it("plays its span from the track, from its origin", () => {
    const trimmed = { ...clip, animationOrigin: 2 * S };
    expect(sourceSpan(trimmed)).toBe(8 * S);
    expect(sourceTimeAt(trimmed, trimmed.start + S)).toBe(5 * S + 4 * S);
  });

  it("keeps content time and its inverse together", () => {
    const at = contentTime(clip, clip.start + S);
    expect(timeOfContent(clip, at)).toBeCloseTo(clip.start + S, -1);
  });

  it("says the rate playing at a time", () => {
    expect(rateAt(clip, clip.start)).toBe(1);
    expect(rateAt(clip, clip.start + 10 * S)).toBe(4);
    expect(rateAt({ ...clip, animation: undefined }, clip.start)).toBe(1);
  });

  it("reads the same through the copy animatedClip makes", () => {
    const shown = animatedClip(clip, clip.start + S);
    expect(sourceTimeAt(shown, clip.start + S)).toBe(sourceTimeAt(clip, clip.start + S));
    expect(sourceSpan(shown)).toBe(sourceSpan(clip));
  });

  it("fills in a partial speed", () => {
    const shown = animatedClip(clip, clip.start);
    expect(speedOf(shown)).toEqual({ rate: 1, pitchCorrection: true, reversed: false });
  });

  it("isn't the same speed as a clip with another ramp", () => {
    expect(sameSpeed(clip, { ...clip })).toBe(true);
    expect(sameSpeed(clip, { ...clip, animation: undefined })).toBe(false);
    const other = { ...ramp, keys: [{ id: "a", t: 0, value: 2 }] };
    expect(sameSpeed(clip, { ...clip, animation: { [RAMP_PATH]: other } })).toBe(false);
  });

  it("is the same speed as its partner with another origin", () => {
    const later = {
      ...ramp,
      keys: ramp.keys.map((key) => ({ ...key, t: key.t + S })),
    };
    const partner = { ...clip, animationOrigin: S, animation: { [RAMP_PATH]: later } };
    expect(sameSpeed(clip, partner)).toBe(true);
  });
});
