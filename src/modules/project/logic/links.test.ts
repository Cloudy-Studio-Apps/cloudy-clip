import { describe, expect, it } from "vitest";
import { seedProject } from "../project.testing";
import type { ProjectState } from "../project.types";
import { partnersOf, withPartners } from "./links";

const S = 1_000_000;

/** A video clip "v" and an audio clip "a" linked by "l1", plus an unlinked audio clip "x". */
function linkedProject(): ProjectState {
  const state = seedProject();
  const [video, audio] = state.compositions.c1!.trackOrder as [string, string];
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

describe("links", () => {
  it("finds the partner of a linked clip", () => {
    expect(partnersOf(linkedProject(), "v").map((c) => c.id)).toEqual(["a"]);
  });

  it("has no partners for an unlinked clip", () => {
    expect(partnersOf(linkedProject(), "x")).toEqual([]);
  });

  it("ignores a link whose partner is gone", () => {
    const state = linkedProject();
    delete state.clips.a;
    expect(partnersOf(state, "v")).toEqual([]);
  });

  it("expands ids with partners, input order first, without duplicates", () => {
    const state = linkedProject();
    expect(withPartners(state, ["v"])).toEqual(["v", "a"]);
    expect(withPartners(state, ["a", "v"])).toEqual(["a", "v"]);
    expect(withPartners(state, ["x"])).toEqual(["x"]);
  });
});
