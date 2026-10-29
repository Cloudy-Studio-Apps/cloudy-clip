import { describe, expect, it } from "vitest";
import { createEmptyProject, type ProjectState } from "@/modules/project";
import {
  clampTrim,
  findOverlap,
  freeTrack,
  neighbourBounds,
  snapCandidates,
  snapSpan,
  snapTime,
  trackEnd,
} from "./placement";

const S = 1_000_000;

function projectWithClips(spans: Array<[number, number]>): {
  state: ProjectState;
  trackId: string;
} {
  const state = createEmptyProject();
  const trackId = state.trackOrder[0]!;
  spans.forEach(([start, duration], i) => {
    const id = `c${i}`;
    state.clips[id] = {
      id,
      trackId,
      kind: "media",
      props: {},
      mediaId: "m",
      start,
      sourceIn: 0,
      duration,
    };
    state.tracks[trackId]!.clipIds.push(id);
  });
  return { state, trackId };
}

describe("freeTrack", () => {
  it("returns the first track of the kind with room, or undefined", () => {
    const { state, trackId } = projectWithClips([[0, 2 * S]]);
    const second = "v2";
    state.tracks[second] = { ...state.tracks[trackId]!, id: second, clipIds: [] };
    state.trackOrder.splice(1, 0, second);
    expect(freeTrack(state, "video", 3 * S, S)).toBe(trackId);
    expect(freeTrack(state, "video", S, S)).toBe(second);
    state.tracks[second]!.clipIds = ["c0"];
    expect(freeTrack(state, "video", S, S)).toBeUndefined();
  });
});

describe("findOverlap", () => {
  const { state, trackId } = projectWithClips([
    [0, 2 * S],
    [5 * S, 2 * S],
  ]);

  it("detects overlaps and allows touching edges", () => {
    expect(findOverlap(state, trackId, S, S)?.id).toBe("c0");
    expect(findOverlap(state, trackId, 2 * S, 3 * S)).toBeUndefined();
    expect(findOverlap(state, trackId, 4 * S, 2 * S)?.id).toBe("c1");
  });

  it("ignores the given clips", () => {
    expect(findOverlap(state, trackId, S, S, new Set(["c0"]))).toBeUndefined();
  });

  it("computes the track end", () => {
    expect(trackEnd(state, trackId)).toBe(7 * S);
  });
});

/** c0 [0,4) and c1 [3.5,7.5) joined by a 0.5 s junction "j"; c2 [9,10). */
function joinedClips(): { state: ProjectState; trackId: string } {
  const built = projectWithClips([
    [0, 4 * S],
    [3.5 * S, 4 * S],
    [9 * S, S],
  ]);
  built.state.junctions.j = {
    id: "j",
    kind: "test",
    trackId: built.trackId,
    leftClipId: "c0",
    rightClipId: "c1",
    duration: 0.5 * S,
    props: {},
  };
  return built;
}

describe("junction-aware placement", () => {
  it("findOverlap with self skips a neighbour overlapping by exactly the junction", () => {
    const { state, trackId } = joinedClips();
    const c1 = state.clips.c1!;
    expect(findOverlap(state, trackId, c1.start, c1.duration, new Set(["c1"]))?.id).toBe("c0");
    expect(findOverlap(state, trackId, c1.start, c1.duration, new Set(["c1"]), c1)).toBeUndefined();
    // Another overlap than the junction's is still in the way.
    expect(findOverlap(state, trackId, 3 * S, c1.duration, new Set(["c1"]), c1)?.id).toBe("c0");
    const c0 = state.clips.c0!;
    expect(findOverlap(state, trackId, 0, c0.duration, new Set(["c0"]), c0)).toBeUndefined();
  });

  it("neighbourBounds stops a joined neighbour at its edge minus the overlap", () => {
    const { state } = joinedClips();
    expect(neighbourBounds(state, state.clips.c1!)).toEqual({ prevEnd: 3.5 * S, nextStart: 9 * S });
    expect(neighbourBounds(state, state.clips.c0!)).toEqual({ prevEnd: 0, nextStart: 4 * S });
  });

  it("neighbourBounds with a ripple edge ignores the neighbour joined on that edge", () => {
    const { state } = joinedClips();
    expect(neighbourBounds(state, state.clips.c0!, "end")).toEqual({
      prevEnd: 0,
      nextStart: 9 * S,
    });
    expect(neighbourBounds(state, state.clips.c1!, "start")).toEqual({
      prevEnd: 0,
      nextStart: 9 * S,
    });
    expect(neighbourBounds(state, state.clips.c1!, "end")).toEqual({
      prevEnd: 3.5 * S,
      nextStart: 9 * S,
    });
  });

  it("snapCandidates include the junction's cut (middle of the overlap)", () => {
    const { state } = joinedClips();
    expect(snapCandidates(state, 0)).toContain(3.75 * S);
    expect(snapCandidates(state, 0, new Set(["c1"]))).not.toContain(3.75 * S);
  });
});

describe("clampTrim", () => {
  const limits = { mediaDuration: 10 * S, minDuration: 100_000, prevEnd: 0, nextStart: Infinity };

  it("trims the start and shifts the source in-point", () => {
    const clip = { start: 2 * S, sourceIn: 1 * S, duration: 4 * S };
    expect(clampTrim(clip, "start", 3 * S, limits)).toEqual({
      start: 3 * S,
      sourceIn: 2 * S,
      duration: 3 * S,
    });
  });

  it("cannot extend the start before the source begins", () => {
    const clip = { start: 2 * S, sourceIn: 1 * S, duration: 4 * S };
    expect(clampTrim(clip, "start", 0, limits)).toEqual({ start: S, sourceIn: 0, duration: 5 * S });
  });

  it("cannot extend the end past the source or into the next clip", () => {
    const clip = { start: 0, sourceIn: 8 * S, duration: S };
    expect(clampTrim(clip, "end", 5 * S, limits).duration).toBe(2 * S);
    expect(clampTrim(clip, "end", 5 * S, { ...limits, nextStart: 1.5 * S }).duration).toBe(1.5 * S);
  });

  it("keeps a minimum length", () => {
    const clip = { start: 0, sourceIn: 0, duration: S };
    expect(clampTrim(clip, "end", -5 * S, limits).duration).toBe(100_000);
    expect(clampTrim(clip, "start", 5 * S, limits).duration).toBe(100_000);
  });

  it("stops at the previous clip", () => {
    const { state } = projectWithClips([
      [0, 2 * S],
      [3 * S, 2 * S],
    ]);
    const clip = state.clips.c1!;
    const bounds = neighbourBounds(state, clip);
    expect(bounds).toEqual({ prevEnd: 2 * S, nextStart: Infinity });
    const trimmed = clampTrim({ ...clip, sourceIn: 5 * S }, "start", 0, { ...limits, ...bounds });
    expect(trimmed.start).toBe(2 * S);
  });
});

describe("snapping", () => {
  it("snaps to the closest candidate within the threshold", () => {
    expect(snapTime(1_050_000, [0, S, 2 * S], 100_000)).toBe(S);
    expect(snapTime(1_500_000, [0, S, 2 * S], 100_000)).toBe(1_500_000);
  });

  it("snaps a span by its end edge when that is closer", () => {
    expect(snapSpan(500_000, S, [1_520_000], 50_000)).toBe(520_000);
    expect(snapSpan(500_000, S, [490_000, 1_520_000], 50_000)).toBe(490_000);
  });
});

describe("junction-aware placement with kind limits", () => {
  const kindOf = (kind: string) =>
    kind === "test"
      ? ({
          kind: "test",
          name: "Test",
          overlap: { default: 0.5 * S, min: () => 0.1 * S, max: () => 2 * S },
        } as never)
      : undefined;

  it("accepts a joined overlap of another length within the kind's limits", () => {
    const { state, trackId } = joinedClips();
    const c1 = state.clips.c1!;
    const ignore = new Set(["c1"]);
    expect(findOverlap(state, trackId, 3.4 * S, c1.duration, ignore, c1, kindOf)).toBeUndefined();
    // Beyond the maximum or not overlapping by a positive amount is still in the way.
    expect(findOverlap(state, trackId, 1.5 * S, c1.duration, ignore, c1, kindOf)?.id).toBe("c0");
    expect(findOverlap(state, trackId, 1.9 * S, c1.duration, ignore, c1, kindOf)?.id).toBe("c0");
  });

  it("accepts any positive overlap for an unregistered kind", () => {
    const { state, trackId } = joinedClips();
    state.junctions.j!.kind = "gone";
    const c1 = state.clips.c1!;
    expect(
      findOverlap(state, trackId, 1 * S, c1.duration, new Set(["c1"]), c1, kindOf),
    ).toBeUndefined();
  });

  it("does not accept an overlap with a clip that is not joined", () => {
    const { state, trackId } = joinedClips();
    const c2 = state.clips.c2!;
    expect(findOverlap(state, trackId, 7 * S, 2.5 * S, new Set(["c2"]), c2, kindOf)?.id).toBe("c1");
  });
});
