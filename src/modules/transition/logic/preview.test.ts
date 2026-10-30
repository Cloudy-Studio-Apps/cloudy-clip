import { describe, expect, it } from "vitest";
import type { Cut, JunctionKindDefinition } from "@/modules/junction";
import { createEmptyProject, type Clip, type ProjectState } from "@/modules/project";
import { previewOnCut } from "./preview";

const S = 1_000_000;

const kind = {
  kind: "transition",
  overlap: {
    default: S / 2,
    min: () => S / 30,
    max: (left: Clip, right: Clip) => Math.min(left.duration, right.duration) / 2,
  },
} as unknown as JunctionKindDefinition;

function setup(duration: number): { state: ProjectState; cut: Cut } {
  const state = createEmptyProject();
  const trackId = state.trackOrder[0]!;
  const clip = (id: string, start: number): Clip => ({
    id,
    trackId,
    kind: "media",
    props: {},
    start,
    sourceIn: 0,
    duration,
  });
  const left = clip("a", 0);
  const right = clip("b", duration);
  state.clips = { a: left, b: right };
  state.tracks[trackId]!.clipIds = ["a", "b"];
  return { state, cut: { trackId, left, right } };
}

describe("previewOnCut", () => {
  it("gives the default duration on a free cut", () => {
    const { state, cut } = setup(4 * S);
    expect(previewOnCut(state, kind, cut)).toEqual({
      duration: S / 2,
      fits: true,
      shifts: { b: -S / 2 },
    });
  });

  it("clamps the duration to what short clips allow", () => {
    const { state, cut } = setup(S / 2);
    expect(previewOnCut(state, kind, cut)).toMatchObject({ duration: S / 4, fits: true });
  });

  it("doesn't fit when the clips are too short for the minimum", () => {
    const { state, cut } = setup(S / 20);
    expect(previewOnCut(state, kind, cut).fits).toBe(false);
  });

  it("doesn't fit when the shift would hit an unlinked clip", () => {
    const { state, cut } = setup(4 * S);
    const audio = state.trackOrder[1]!;
    state.clips.b!.linkId = "l";
    state.clips.s = {
      id: "s",
      trackId: audio,
      kind: "media",
      props: {},
      start: 4 * S,
      sourceIn: 0,
      duration: S,
      linkId: "l",
    };
    state.clips.x = { ...state.clips.s, id: "x", start: 3 * S, duration: S, linkId: undefined };
    state.tracks[audio]!.clipIds = ["x", "s"];
    expect(previewOnCut(state, kind, cut)).toMatchObject({ fits: false, shifts: {} });
  });

  it("keeps the duration of a transition already on the cut", () => {
    const { state, cut } = setup(4 * S);
    state.junctions.j = {
      id: "j",
      kind: "transition",
      trackId: cut.trackId,
      leftClipId: "a",
      rightClipId: "b",
      duration: S,
      props: {},
    };
    expect(previewOnCut(state, kind, cut)).toEqual({ duration: S, fits: true, shifts: {} });
  });

  it("doesn't fit on a cut holding another kind of junction", () => {
    const { state, cut } = setup(4 * S);
    state.junctions.j = {
      id: "j",
      kind: "other",
      trackId: cut.trackId,
      leftClipId: "a",
      rightClipId: "b",
      duration: 0,
      props: {},
    };
    expect(previewOnCut(state, kind, cut).fits).toBe(false);
  });
});
