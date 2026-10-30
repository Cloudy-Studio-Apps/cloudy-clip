import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { compositionContent, frameDuration } from "../project.selectors";
import { seedProject } from "../project.testing";
import type { Clip, ProjectState } from "../project.types";
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
