import { describe, expect, it } from "vitest";
import { DEFAULT_SOUND, fadeLevel } from "./sound";

const S = 1_000_000;

describe("fadeLevel", () => {
  it("multiplies overlapping fades, as the export's two afade filters do", () => {
    const sound = { ...DEFAULT_SOUND, fadeIn: 2 * S, fadeOut: 2 * S };
    // Each equal-power half is sin(pi/4) at the middle: their product is 0.5.
    expect(fadeLevel(sound, { start: 0, duration: 2 * S }, S)).toBeCloseTo(0.5, 9);
  });
});
