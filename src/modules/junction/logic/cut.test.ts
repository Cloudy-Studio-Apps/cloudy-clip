import { describe, expect, it } from "vitest";
import { createEmptyProject, type ProjectState } from "@/modules/project";
import { cutAfter, cutNear } from "./cut";

const S = 1_000_000;

/** Two clips on the first track: a (0..S) and b starting at `bStart`; optionally joined by a junction. */
function pair(bStart: number, junction?: number): ProjectState {
  const s = createEmptyProject();
  const trackId = s.trackOrder[0]!;
  for (const [id, start] of [
    ["a", 0],
    ["b", bStart],
  ] as const) {
    s.clips[id] = { id, trackId, kind: "media", props: {}, start, sourceIn: 0, duration: S };
    s.tracks[trackId]!.clipIds.push(id);
  }
  if (junction !== undefined) {
    s.junctions["j"] = {
      id: "j",
      kind: "test.fade",
      trackId,
      leftClipId: "a",
      rightClipId: "b",
      duration: junction,
      props: {},
    };
  }
  return s;
}

describe("cutNear", () => {
  it("cutNear finds a touching pair and ignores a gap of 1 µs", () => {
    const touching = pair(S);
    const trackId = touching.trackOrder[0]!;
    const cut = cutNear(touching, trackId, S + 100, 1000);
    expect(cut?.left.id).toBe("a");
    expect(cut?.right.id).toBe("b");
    expect(cutNear(touching, trackId, S + 5000, 1000)).toBeUndefined();

    const gap = pair(S + 1);
    expect(cutNear(gap, trackId, S, 1000)).toBeUndefined();
  });

  it("cutNear finds an already-joined overlapping pair at its cut", () => {
    const joined = pair(S - 200_000, 200_000);
    const trackId = joined.trackOrder[0]!;
    expect(cutNear(joined, trackId, S - 100_000, 1000)?.right.id).toBe("b");
    expect(cutNear(joined, trackId, S + 500_000, 1000)).toBeUndefined();
  });

  it("ignores an overlap that isn't a junction", () => {
    const loose = pair(S - 200_000);
    expect(cutNear(loose, loose.trackOrder[0]!, S - 100_000, 1000)).toBeUndefined();
  });
});

describe("cutAfter", () => {
  it("returns the cut after the left clip", () => {
    expect(cutAfter(pair(S), "a")?.right.id).toBe("b");
  });

  it("cutAfter returns undefined for the last clip", () => {
    expect(cutAfter(pair(S), "b")).toBeUndefined();
    expect(cutAfter(pair(S), "missing")).toBeUndefined();
  });
});
