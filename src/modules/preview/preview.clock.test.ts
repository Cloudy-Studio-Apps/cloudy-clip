import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaybackClock } from "./preview.clock";

const FRAME = 40_000;
let now = 0;
let frames: Array<(at: number) => void> = [];

/** Advances the wall clock by `ms` and runs the frame the clock asked for. */
function step(ms: number): void {
  now += ms;
  const queued = frames;
  frames = [];
  for (const callback of queued) callback(now);
}

beforeEach(() => {
  now = 0;
  frames = [];
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: (at: number) => void) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("playback clock loop", () => {
  it("goes back to the loop's start on reaching its end while playing", () => {
    const clock = createPlaybackClock(
      () => 10_000_000,
      () => FRAME,
    );
    expect(clock.setLoop({ from: 1_000_000, to: 2_000_000 })).toBe(true);
    clock.seek(1_500_000);
    clock.play();
    step(400);
    expect(clock.getTime()).toBe(1_900_000);
    step(100);
    expect(clock.getTime()).toBe(1_000_000);
    expect(clock.isPlaying()).toBe(true);
    step(250);
    expect(clock.getTime()).toBe(1_250_000);
  });

  it("refuses a range shorter than one frame and clamps an end past the composition", () => {
    const clock = createPlaybackClock(
      () => 10_000_000,
      () => FRAME,
    );
    expect(clock.setLoop({ from: 1_000_000, to: 1_000_000 + FRAME - 1 })).toBe(false);
    expect(clock.getLoop()).toBeNull();
    expect(clock.setLoop({ from: 9_000_000, to: 12_000_000 })).toBe(true);
    expect(clock.getLoop()).toEqual({ from: 9_000_000, to: 10_000_000 });
  });
});
