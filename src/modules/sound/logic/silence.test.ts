import { describe, expect, it } from "vitest";
import type { Clip } from "@/modules/project";
import { cutsFor } from "./silence";

const S = 1_000_000;
const clip = (over: Partial<Clip> = {}): Clip =>
  ({
    id: "c",
    trackId: "a1",
    kind: "media",
    start: 0,
    duration: 10 * S,
    sourceIn: 0,
    ...over,
  }) as Clip;

describe("cutsFor", () => {
  it("keeps stretches shorter than the minimum", () => {
    const cuts = cutsFor(
      clip(),
      [
        [S, S + 300_000],
        [4 * S, 6 * S],
      ],
      0,
      500,
    );
    expect(cuts).toEqual([{ start: 4 * S, end: 6 * S }]);
  });

  it("keeps the padding of quiet on each side, and drops a cut it eats whole", () => {
    expect(
      cutsFor(
        clip(),
        [
          [4 * S, 6 * S],
          [8 * S, 8 * S + 150_000],
        ],
        100,
      ),
    ).toEqual([{ start: 4 * S + 100_000, end: 6 * S - 100_000 }]);
  });

  it("maps file time to the timeline through the clip's trim, start and speed", () => {
    // Plays file 2 s..12 s from timeline 5 s at twice the speed: 5 s long.
    const fast = clip({
      start: 5 * S,
      sourceIn: 2 * S,
      duration: 5 * S,
      speed: { rate: 2, pitchCorrection: true, reversed: false },
    });
    expect(cutsFor(fast, [[4 * S, 8 * S]], 0)).toEqual([{ start: 6 * S, end: 8 * S }]);
  });

  it("clamps to what the clip plays and flips a reversed clip", () => {
    const back = clip({
      sourceIn: 0,
      duration: 10 * S,
      speed: { rate: 1, pitchCorrection: true, reversed: true },
    });
    expect(cutsFor(back, [[8 * S, 12 * S]], 0)).toEqual([{ start: 0, end: 2 * S }]);
  });
});
