import { describe, expect, it } from "vitest";
import { seedProject, type Clip, type Junction, type ProjectState } from "@/modules/project";
import { planGroup } from "./group";

const S = 1_000_000;

const clip = (id: string, trackId: string, start: number, extra: Partial<Clip> = {}): Clip => ({
  id,
  kind: "text",
  trackId,
  start,
  sourceIn: 0,
  duration: 2 * S,
  props: {},
  ...extra,
});

function state(clips: Clip[], junctions: Junction[] = []): ProjectState {
  const seeded = seedProject({
    tracks: {
      t1: { id: "t1", kind: "video", name: "1", clipIds: [], muted: false, hidden: false },
      t2: { id: "t2", kind: "video", name: "2", clipIds: [], muted: false, hidden: false },
      a1: { id: "a1", kind: "audio", name: "A", clipIds: [], muted: false, hidden: false },
    },
  });
  for (const c of [...clips].sort((a, b) => a.start - b.start)) {
    seeded.clips[c.id] = c;
    seeded.tracks[c.trackId]!.clipIds.push(c.id);
  }
  for (const j of junctions) seeded.junctions[j.id] = j;
  return seeded;
}

describe("planGroup", () => {
  it("spans the selection on the topmost selected tracks", () => {
    const plan = planGroup(state([clip("a", "t2", 2 * S), clip("b", "t1", 6 * S)]), ["a", "b"]);
    expect(plan).toMatchObject({
      span: { start: 2 * S, end: 8 * S },
      videoTrack: "t1",
      audioTrack: null,
    });
  });

  it("is blocked by an unselected clip inside the span", () => {
    const clips = [clip("a", "t1", 0), clip("other", "t1", 4 * S), clip("b", "t1", 8 * S)];
    expect(planGroup(state(clips), ["a", "b"])).toMatchObject({ blocked: { id: "other" } });
  });

  it("brings linked partners, and drops a junction crossing the edge", () => {
    const clips = [
      clip("a", "t1", 0, { linkId: "k" }),
      clip("aSound", "a1", 0, { linkId: "k" }),
      clip("next", "t1", 2 * S),
    ];
    const crossing: Junction = {
      id: "j1",
      kind: "cut",
      trackId: "t1",
      leftClipId: "a",
      rightClipId: "next",
      duration: 0,
      props: {},
    };
    expect(planGroup(state(clips, [crossing]), ["a"])).toMatchObject({
      clips: ["a", "aSound"],
      droppedJunctions: ["j1"],
      audioTrack: "a1",
    });
  });
});
