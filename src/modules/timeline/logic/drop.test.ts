import { describe, expect, it } from "vitest";
import { laneDropTarget } from "./drop";

const lanes = [
  { trackId: "v1", left: 100, top: 0, bottom: 60 },
  { trackId: "a1", left: 100, top: 60, bottom: 100 },
];

describe("laneDropTarget", () => {
  it("finds the lane and the time under the pointer", () => {
    // 50 px per second: 150 px right of the lane start is 3 s.
    expect(laneDropTarget(lanes, 250, 70, 50)).toEqual({ trackId: "a1", time: 3_000_000 });
  });

  it("clamps times before the lane start to 0", () => {
    expect(laneDropTarget(lanes, 40, 10, 50)).toEqual({ trackId: "v1", time: 0 });
  });

  it("returns null outside every lane", () => {
    expect(laneDropTarget(lanes, 250, 140, 50)).toBeNull();
  });
});
