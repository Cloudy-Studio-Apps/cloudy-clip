import { describe, expect, it } from "vitest";
import { createEmptyProject, type ProjectState } from "@/modules/project";
import { selectionSubject } from "./links";

const S = 1_000_000;

/** A video clip "v" and an audio clip "a" linked by "l1", plus an unlinked audio clip "x". */
function linkedProject(): ProjectState {
  const state = createEmptyProject();
  const [video, audio] = state.trackOrder as [string, string];
  const clip = (id: string, trackId: string, start: number, linkId?: string) => {
    state.clips[id] = {
      id,
      trackId,
      kind: "media",
      props: {},
      mediaId: "m",
      start,
      sourceIn: 0,
      duration: S,
      linkId,
    };
    state.tracks[trackId]!.clipIds.push(id);
  };
  clip("v", video, 0, "l1");
  clip("a", audio, 0, "l1");
  clip("x", audio, 2 * S);
  return state;
}

describe("selectionSubject", () => {
  it("finds the one clip a selection is about", () => {
    const state = linkedProject();
    expect(selectionSubject(state, [])).toBeUndefined();
    expect(selectionSubject(state, ["x"])).toBe("x");
    expect(selectionSubject(state, ["a", "v"])).toBe("a");
    expect(selectionSubject(state, ["v", "x"])).toBeUndefined();
  });
});
