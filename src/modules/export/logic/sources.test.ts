import { describe, expect, it } from "vitest";
import { seedProject, type Clip, type ProjectState } from "@/modules/project";
import { reversedMedia } from "./sources";

const speed = { rate: 1, pitchCorrection: true, reversed: true };
const clip = (id: string, trackId: string, mediaId: string, extra: Partial<Clip> = {}): Clip => ({
  id,
  trackId,
  kind: "media",
  mediaId,
  start: 0,
  sourceIn: 0,
  duration: 4_000_000,
  props: {},
  speed,
  ...extra,
});

function project(clips: Clip[]): ProjectState {
  const state = seedProject();
  for (const one of clips) {
    state.clips[one.id] = one;
    state.tracks[one.trackId]?.clipIds.push(one.id);
  }
  return state;
}

const all = { start: 0, duration: 10_000_000 };

describe("reversedMedia", () => {
  it("finds a picture played backwards in the stretch", () => {
    expect([...reversedMedia(project([clip("a", "v1", "m")]), "c1", all)]).toEqual(["m"]);
  });

  it("needs no copy for sound, which export reverses itself", () => {
    expect(reversedMedia(project([clip("a", "a1", "m")]), "c1", all).size).toBe(0);
  });

  it("ignores a forward clip of a file that is reversed elsewhere", () => {
    const state = project([clip("a", "v1", "m", { speed: undefined })]);
    state.compositions.other = { ...state.compositions.c1!, id: "other", trackOrder: ["t9"] };
    state.tracks.t9 = { ...state.tracks.v1!, id: "t9", compositionId: "other", clipIds: ["b"] };
    state.clips.b = clip("b", "t9", "m");
    expect(reversedMedia(state, "c1", all).size).toBe(0);
  });

  it("ignores a disabled clip", () => {
    const state = project([clip("a", "v1", "m", { disabled: true })]);
    expect(reversedMedia(state, "c1", all).size).toBe(0);
  });
});
