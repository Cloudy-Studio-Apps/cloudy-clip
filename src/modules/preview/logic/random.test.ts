import { describe, expect, it } from "vitest";
import { seededRandom } from "./random";

describe("seededRandom", () => {
  it("gives the same sequence for the same seed", () => {
    const a = seededRandom("junction-1");
    const b = seededRandom("junction-1");
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("gives different sequences for different seeds", () => {
    const a = seededRandom("junction-1");
    const b = seededRandom("junction-2");
    expect(a()).not.toBe(b());
  });

  it("stays in [0, 1)", () => {
    const next = seededRandom("x");
    for (let i = 0; i < 1000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
