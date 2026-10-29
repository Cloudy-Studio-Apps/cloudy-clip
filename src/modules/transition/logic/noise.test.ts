import { describe, expect, it } from "vitest";
import { blockMask, seededRandom } from "./noise";

describe("noise", () => {
  it("seededRandom is deterministic per seed and differs across seeds", () => {
    const a = seededRandom("x");
    const b = seededRandom("x");
    const c = seededRandom("y");
    const seqA = [a(), a(), a()];
    expect(seqA).toEqual([b(), b(), b()]);
    expect(seqA).not.toEqual([c(), c(), c()]);
  });
  it("blockMask has one value per block and values in [0,1)", () => {
    const m = blockMask(100, 50, 30, "s");
    expect(m.length).toBe(4 * 2);
    for (const v of m) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
