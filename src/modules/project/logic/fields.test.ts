import { describe, expect, it } from "vitest";
import type { Clip, ProjectState, Track } from "../project.types";
import { projectPolicy } from "./fields";

function clip(id: string, start: number, extra: Partial<Clip> = {}): Clip {
  return {
    id,
    kind: "text",
    trackId: "t1",
    start,
    sourceIn: 0,
    duration: 10,
    props: {},
    ...extra,
  };
}

function track(id: string, clipIds: string[]): Track {
  return { id, kind: "video", name: id, clipIds, muted: false, hidden: false };
}

const before: ProjectState = {
  format: { width: 1080, height: 1920, fps: 30 },
  media: {},
  mediaOrder: [],
  tracks: { t1: track("t1", ["c1", "c2"]), t2: track("t2", []) },
  trackOrder: ["t1", "t2"],
  clips: {
    c1: clip("c1", 0, { props: { text: "a", size: 10 } }),
    c2: clip("c2", 20),
  },
  junctions: {},
};

const paths = (after: ProjectState) => projectPolicy.diff(before, after).map((c) => c.path);

describe("project field changes", () => {
  it("sees one field in a whole-record replace", () => {
    const after = { ...before, clips: { ...before.clips, c1: { ...before.clips.c1!, start: 5 } } };
    expect(projectPolicy.diff(before, after)).toEqual([
      { path: ["clips", "c1", "start"], before: 0, after: 5 },
    ]);
  });

  it("ignores a replaced record with equal values", () => {
    const after = { ...before, clips: { ...before.clips, c1: { ...before.clips.c1! } } };
    expect(projectPolicy.diff(before, after)).toEqual([]);
  });

  it("goes one level into plain-object fields", () => {
    const c1 = { ...before.clips.c1!, props: { text: "a", size: 20 } };
    expect(paths({ ...before, clips: { ...before.clips, c1 } })).toEqual([
      ["clips", "c1", "props", "size"],
    ]);
  });

  it("reports a created entity as one change", () => {
    const after = { ...before, clips: { ...before.clips, c9: clip("c9", 50) } };
    expect(projectPolicy.diff(before, after)).toEqual([
      { path: ["clips", "c9"], before: undefined, after: after.clips.c9 },
    ]);
  });

  it("reports a deleted entity as one change", () => {
    const { c2, ...clips } = before.clips;
    expect(projectPolicy.diff(before, { ...before, clips })).toEqual([
      { path: ["clips", "c2"], before: c2, after: undefined },
    ]);
  });

  it("never reports ordering arrays", () => {
    const after = {
      ...before,
      tracks: { ...before.tracks, t1: track("t1", ["c2", "c1"]) },
      trackOrder: ["t2", "t1"],
      mediaOrder: ["m1"],
    };
    expect(projectPolicy.diff(before, after)).toEqual([]);
  });
});

describe("project repair", () => {
  it("rebuilds clipIds from trackId, sorted by start, and the order lists", () => {
    const state = structuredClone(before);
    state.clips.c2!.trackId = "t2";
    state.clips.c3 = clip("c3", 5, { trackId: "t2" });
    state.tracks.t3 = track("t3", []);
    state.trackOrder = ["t1", "gone", "t2"];
    projectPolicy.repair(state);
    expect(state.tracks.t1!.clipIds).toEqual(["c1"]);
    expect(state.tracks.t2!.clipIds).toEqual(["c3", "c2"]);
    expect(state.trackOrder).toEqual(["t1", "t2", "t3"]);
  });
});

describe("project validate", () => {
  const withClip = (c: Clip): ProjectState => ({ ...before, clips: { ...before.clips, c3: c } });
  const junction = (id: string, leftClipId: string, rightClipId: string, duration = 0) => ({
    id,
    kind: "transition",
    trackId: "t1",
    leftClipId,
    rightClipId,
    duration,
    props: {},
  });
  const adjacent: ProjectState = {
    ...before,
    clips: { c1: clip("c1", 0), c2: clip("c2", 10) },
  };

  it("accepts a good document", () => {
    expect(projectPolicy.validate(before)).toBeNull();
  });

  it.each<[string, ProjectState]>([
    ["a clip on a missing track", withClip(clip("c3", 90, { trackId: "gone" }))],
    ["a clip on missing media", withClip(clip("c3", 90, { mediaId: "gone" }))],
    [
      "overlapping clips",
      {
        ...before,
        clips: { c1: clip("c1", 0), c2: clip("c2", 5) },
      },
    ],
    ["a junction with a missing clip", { ...before, junctions: { j1: junction("j1", "c1", "x") } }],
    ["a stale junction", { ...adjacent, junctions: { j1: junction("j1", "c1", "c2", 4) } }],
    [
      "two junctions on one cut",
      {
        ...adjacent,
        junctions: { j1: junction("j1", "c1", "c2"), j2: junction("j2", "c1", "c2") },
      },
    ],
  ])("refuses %s", (_name, state) => {
    expect(projectPolicy.validate(state)).not.toBeNull();
  });
});
