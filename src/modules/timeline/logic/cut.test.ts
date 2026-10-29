import { describe, expect, it } from "vitest";
import { createEmptyProject, type ProjectState } from "@/modules/project";
import { cutAtX } from "./cut";

const S = 1_000_000;

/** Clips a (0..1 s) and b (starting at `bStart`) on the first track. */
function pair(bStart: number): ProjectState {
  const s = createEmptyProject();
  const trackId = s.trackOrder[0]!;
  for (const [id, start] of [
    ["a", 0],
    ["b", bStart],
  ] as const) {
    s.clips[id] = { id, trackId, kind: "media", props: {}, start, sourceIn: 0, duration: S };
    s.tracks[trackId]!.clipIds.push(id);
  }
  return s;
}

describe("cutAtX", () => {
  it("cutAtX finds the cut within tolerance", () => {
    const state = pair(S);
    const trackId = state.trackOrder[0]!;
    // 100 px/s: the cut is at x = 100.
    expect(cutAtX(state, trackId, 104, 100, 8)?.right.id).toBe("b");
    expect(cutAtX(state, trackId, 92, 100, 8)?.left.id).toBe("a");
    expect(cutAtX(state, trackId, 120, 100, 8)).toBeUndefined();
  });

  it("cutAtX ignores gaps", () => {
    const state = pair(2 * S);
    expect(cutAtX(state, state.trackOrder[0]!, 100, 100, 8)).toBeUndefined();
    expect(cutAtX(state, state.trackOrder[0]!, 200, 100, 8)).toBeUndefined();
  });
});
