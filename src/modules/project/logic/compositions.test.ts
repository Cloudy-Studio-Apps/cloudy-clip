import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { compositionContent, frameDuration } from "../project.selectors";
import { seedProject } from "../project.testing";
import { projectPolicy } from "./fields";
import type { Clip, ProjectState, Track } from "../project.types";
import { contains, settleCompositions } from "./compositions";

const S = 1_000_000;

function clip(id: string, trackId: string, start: number, duration: number): Clip {
  return { id, kind: "text", trackId, start, sourceIn: 0, duration, props: {} };
}

/** `c1` holding a clip that ends at `end`, Extend to fit as given. */
function withClip(end: number, extendToFit: boolean, duration = 9 * S): ProjectState {
  const state = seedProject({ clips: { a: clip("a", "v1", 0, end) } });
  state.tracks.v1!.clipIds = ["a"];
  state.compositions.c1!.extendToFit = extendToFit;
  state.compositions.c1!.duration = duration;
  return state;
}

/** `outer` plays `inner`, as a clip on outer's track. */
function nested(): ProjectState {
  const state = seedProject();
  const inner = { ...state.compositions.c1!, id: "inner", trackOrder: ["iv"] };
  state.compositions.inner = inner;
  state.compositions.outer = { ...state.compositions.c1!, id: "outer", trackOrder: ["ov"] };
  const track = { kind: "video" as const, name: "V", muted: false, hidden: false };
  state.tracks.iv = { ...track, id: "iv", compositionId: "inner", clipIds: [] };
  state.tracks.ov = { ...track, id: "ov", compositionId: "outer", clipIds: ["p"] };
  state.clips.p = { ...clip("p", "ov", 0, S), kind: "composition", compositionRef: "inner" };
  return state;
}

const settled = (state: ProjectState) => produce(state, settleCompositions);

describe("contains", () => {
  it("finds a composition placed inside another", () => {
    expect(contains(nested(), "outer", "inner")).toBe(true);
  });

  it("does not look upward", () => {
    expect(contains(nested(), "inner", "outer")).toBe(false);
  });

  it("counts a composition as containing itself", () => {
    expect(contains(nested(), "outer", "outer")).toBe(true);
  });
});

describe("settleCompositions", () => {
  it("follows the last clip while Extend to fit is on", () => {
    expect(settled(withClip(5 * S, true)).compositions.c1!.duration).toBe(5 * S);
  });

  it("is one frame long with no clips", () => {
    const state = seedProject();
    state.compositions.c1!.extendToFit = true;
    const { format } = state.compositions.c1!;
    expect(settled(state).compositions.c1!.duration).toBe(frameDuration(format));
  });

  it("leaves a fixed length alone", () => {
    expect(settled(withClip(5 * S, false)).compositions.c1!.duration).toBe(9 * S);
    expect(compositionContent(withClip(5 * S, false), "c1")).toBe(5 * S);
  });
});

describe("placements", () => {
  const track = (
    id: string,
    compositionId: string,
    kind: Track["kind"],
    clipIds: string[],
  ): Track => ({
    id,
    compositionId,
    kind,
    name: id,
    clipIds,
    muted: false,
    hidden: false,
  });
  const composition = (
    id: string,
    trackOrder: string[],
    duration: number,
    extendToFit = false,
  ) => ({
    id,
    name: id,
    format: { width: 100, height: 100, fps: 30 },
    background: "#000000",
    duration,
    extendToFit,
    trackOrder,
  });
  const place = (
    id: string,
    trackId: string,
    ref: string,
    start: number,
    duration: number,
    linkId?: string,
  ): Clip => ({
    ...clip(id, trackId, start, duration),
    kind: "composition",
    compositionRef: ref,
    ...(linkId && { linkId }),
  });

  /** `main` holds two placements of `intro`, each with its sound, with a clip after them. */
  function twoPlacements(introLength: number, length = 5 * S): ProjectState {
    return {
      compositions: {
        main: composition("main", ["v", "a"], 60 * S),
        intro: composition("intro", ["iv"], introLength),
      },
      compositionOrder: ["main", "intro"],
      mainCompositionId: "main",
      media: {},
      mediaOrder: [],
      tracks: {
        v: track("v", "main", "video", ["p1", "p2"]),
        a: track("a", "main", "audio", ["s1", "s2"]),
        iv: track("iv", "intro", "video", []),
      },
      clips: {
        p1: place("p1", "v", "intro", 0, length, "k1"),
        s1: place("s1", "a", "intro", 0, length, "k1"),
        p2: place("p2", "v", "intro", 20 * S, length, "k2"),
        s2: place("s2", "a", "intro", 20 * S, length, "k2"),
      },
      junctions: {},
    };
  }

  it("shortens every placement in the same step when the original shrinks", () => {
    const after = settled(twoPlacements(3 * S));
    expect(after.clips.p1!.duration).toBe(3 * S);
    expect(after.clips.s1!.duration).toBe(3 * S);
    expect(after.clips.p2!.duration).toBe(3 * S);
  });

  it("leaves placements alone when the original grows", () => {
    expect(settled(twoPlacements(9 * S)).clips.p1!.duration).toBe(5 * S);
  });

  it("moves sourceIn back when the placement would start past the end", () => {
    const state = twoPlacements(3 * S);
    state.clips.p1!.sourceIn = 4 * S;
    const after = settled(state);
    expect(after.clips.p1!.sourceIn).toBe(3 * S - 33_334);
    expect(after.clips.p1!.duration).toBe(33_334);
  });

  it("settles nested originals innermost first", () => {
    const state = twoPlacements(2 * S);
    // outer plays main-like `middle`, which follows its placement of intro.
    state.compositions.middle = composition("middle", ["mv"], 5 * S, true);
    state.compositions.outer = composition("outer", ["ov"], 60 * S);
    state.compositionOrder.push("middle", "outer");
    state.tracks.mv = track("mv", "middle", "video", ["m"]);
    state.tracks.ov = track("ov", "outer", "video", ["o"]);
    state.clips.m = place("m", "mv", "intro", 0, 5 * S);
    state.clips.o = place("o", "ov", "middle", 0, 5 * S);
    expect(settled(state).clips.o!.duration).toBe(2 * S);
  });

  it("removes a broken transition, leaves no overlap and moves nothing", () => {
    const state = twoPlacements(10 * S, 10 * S);
    state.clips.p2!.start = 9 * S;
    state.clips.s2!.start = 9 * S;
    state.junctions.j = {
      id: "j",
      kind: "transition",
      trackId: "v",
      leftClipId: "p1",
      rightClipId: "p2",
      duration: S,
      props: {},
    };
    state.compositions.intro!.duration = 9.5 * S;
    const after = settled(state);
    expect(after.junctions).toEqual({});
    expect(after.clips.p1!.duration).toBe(9 * S);
    expect(after.clips.s1!.duration).toBe(9 * S);
    expect(after.clips.p2!.start).toBe(9 * S);
    expect(projectPolicy.validate(after)).toBeNull();
  });

  it("doesn't touch a transition that still fits", () => {
    const state = twoPlacements(20 * S, 10 * S);
    state.clips.p2!.start = 9 * S;
    state.clips.s2!.start = 9 * S;
    state.junctions.j = {
      id: "j",
      kind: "transition",
      trackId: "v",
      leftClipId: "p1",
      rightClipId: "p2",
      duration: S,
      props: {},
    };
    expect(settled(state).junctions.j).toBeDefined();
  });
});
