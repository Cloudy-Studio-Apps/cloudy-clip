import { describe, expect, it } from "vitest";
import { clampToClip, contentTime, timeOfContent } from "./content";

const S = 1_000_000;

describe("content time", () => {
  it("is the clip's own time from its origin", () => {
    expect(contentTime({ start: 2 * S, duration: 4 * S, animationOrigin: 500 }, 3 * S)).toBe(
      S + 500,
    );
  });

  it("speeds up with the picture", () => {
    const clip = {
      start: 0,
      duration: 4 * S,
      speed: { rate: 2, pitchCorrection: true, reversed: false },
    };
    expect(contentTime(clip, S)).toBe(2 * S);
    expect(timeOfContent(clip, 2 * S)).toBe(S);
  });

  it("keeps running on a held frame", () => {
    const held = {
      start: 0,
      duration: 3 * S,
      speed: { rate: 0, pitchCorrection: true, reversed: false },
    };
    expect(contentTime(held, S)).toBe(S);
    expect(timeOfContent(held, S)).toBe(S);
  });

  it("runs forward on a reversed clip", () => {
    const back = {
      start: 0,
      duration: 4 * S,
      speed: { rate: 1, pitchCorrection: true, reversed: true },
    };
    expect(contentTime(back, S)).toBe(S);
  });

  it("is not clamped to the clip", () => {
    expect(contentTime({ start: S, duration: S }, 0)).toBe(-S);
  });

  it("clamps a time to the clip's frames", () => {
    expect(clampToClip({ start: S, duration: S }, 0)).toBe(S);
    expect(clampToClip({ start: S, duration: S }, 9 * S)).toBe(2 * S - 1);
  });
});
