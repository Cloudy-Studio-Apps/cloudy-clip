import { describe, expect, it } from "vitest";
import { EASE_PRESETS, easeProgress, presetOf } from "./ease";

describe("ease", () => {
  it("runs every preset from 0 to 1", () => {
    for (const { ease } of EASE_PRESETS.filter((p) => p.id !== "hold")) {
      expect(easeProgress(ease, 0)).toBeCloseTo(0);
      expect(easeProgress(ease, 1)).toBeCloseTo(1);
    }
  });

  it("holds until the end", () => expect(easeProgress({ kind: "hold" }, 0.99)).toBe(0));

  it("overshoots with Overshoot", () => {
    const over = EASE_PRESETS.find((p) => p.id === "overshoot")!.ease;
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map((u) => easeProgress(over, u)))).toBeGreaterThan(1);
  });

  it("names a handmade curve custom", () =>
    expect(presetOf({ kind: "bezier", x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 })).toBe("custom"));

  it("names every preset by itself, and a missing ease linear", () => {
    for (const { id, ease } of EASE_PRESETS) expect(presetOf(ease)).toBe(id);
    expect(presetOf(undefined)).toBe("linear");
  });
});
