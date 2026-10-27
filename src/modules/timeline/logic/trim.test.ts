import { describe, expect, it } from "vitest";
import { createEmptyProject, type Clip, type ProjectState } from "@/modules/project";
import { clampTrim } from "./placement";
import { linkedTrimEdge, trimLimits } from "./trim";

const S = 1_000_000;
const duration = () => 10 * S;

/** Picture "v" and sound "a" at 0–6 s; a clip "n" at 8 s after the sound. */
function project(): { state: ProjectState; group: Clip[] } {
  const state = createEmptyProject();
  const [video, audio] = state.trackOrder as [string, string];
  const add = (id: string, trackId: string, start: number, length: number) => {
    state.clips[id] = { id, trackId, mediaId: "m", start, sourceIn: 0, duration: length };
    state.tracks[trackId]!.clipIds.push(id);
  };
  add("v", video, 0, 6 * S);
  add("a", audio, 0, 6 * S);
  add("n", audio, 8 * S, S);
  return { state, group: [state.clips.v!, state.clips.a!] };
}

describe("trim", () => {
  it("limits a clip by its neighbours and source length", () => {
    const { state } = project();
    expect(trimLimits(state, state.clips.a!, duration)).toMatchObject({
      prevEnd: 0,
      nextStart: 8 * S,
      mediaDuration: 10 * S,
    });
  });

  it("uses the tightest edge of a linked group", () => {
    const { state, group } = project();
    expect(linkedTrimEdge(state, group, "end", 9 * S, duration)).toBe(8 * S);
    expect(linkedTrimEdge(state, group, "end", 7 * S, duration)).toBe(7 * S);
    expect(linkedTrimEdge(state, group, "start", -S, duration)).toBe(0);
  });

  it("lets a text clip grow both ways (it has no source file)", () => {
    const state = createEmptyProject();
    const trackId = state.trackOrder[0]!;
    const text: Clip = {
      id: "t",
      kind: "text",
      text: "Text",
      trackId,
      start: 2 * S,
      sourceIn: 0,
      duration: S,
    };
    state.clips.t = text;
    state.tracks[trackId]!.clipIds.push("t");
    const limits = trimLimits(state, text, duration);
    expect(limits.sourceless).toBe(true);
    expect(clampTrim(text, "start", 0, limits)).toEqual({ start: 0, sourceIn: 0, duration: 3 * S });
    expect(clampTrim(text, "end", 50 * S, limits).duration).toBe(48 * S);
  });
});
