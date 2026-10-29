import { describe, expect, it } from "vitest";
import { blockGrid } from "./grid";

describe("blockGrid", () => {
  it("covers the frame with the asked block size", () => {
    expect(blockGrid(100, 50, 30)).toEqual({ block: 30, cols: 4, rows: 2 });
  });
  it("grows the block to keep the cell count bounded", () => {
    const g = blockGrid(1080, 1920, 4);
    expect(g.cols * g.rows).toBeLessThanOrEqual(20000);
    expect(g.block).toBeGreaterThan(4);
  });
});
