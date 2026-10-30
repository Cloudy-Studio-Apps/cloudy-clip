import { describe, expect, it } from "vitest";
import { seedProject } from "../project.testing";
import type { Junction, ProjectState } from "../project.types";
import {
  allowedOverlap,
  applyMoves,
  findLayoutConflict,
  junctionBetween,
  junctionsOfClip,
  rippleMoves,
  staleJunctions,
} from "./junctions";

const S = 1_000_000;

interface Spec {
  id: string;
  track: 0 | 1;
  start: number;
  duration?: number;
  linkId?: string;
}

/** Video track (0) and audio track (1) with the given clips; clipIds in the order given. */
function state(clips: Spec[], junctions: Junction[] = []): ProjectState {
  const s = seedProject();
  for (const c of clips) {
    const trackId = s.compositions.c1!.trackOrder[c.track]!;
    s.clips[c.id] = {
      id: c.id,
      trackId,
      kind: "media",
      props: {},
      start: c.start,
      sourceIn: 0,
      duration: c.duration ?? S,
      linkId: c.linkId,
    };
    s.tracks[trackId]!.clipIds.push(c.id);
  }
  for (const j of junctions) s.junctions[j.id] = j;
  return s;
}

function junction(s: ProjectState, id: string, left: string, right: string, duration: number) {
  return {
    id,
    kind: "crossfade",
    trackId: s.clips[left]!.trackId,
    leftClipId: left,
    rightClipId: right,
    duration,
    props: {},
  } satisfies Junction;
}

/** Pictures A, B joined by a 0.5 s junction; sounds a, b linked to them. */
function joined(): ProjectState {
  const s = state([
    { id: "A", track: 0, start: 0, linkId: "la" },
    { id: "B", track: 0, start: S / 2, linkId: "lb" },
    { id: "a", track: 1, start: 0, linkId: "la" },
    { id: "b", track: 1, start: S / 2, linkId: "lb" },
    { id: "u", track: 1, start: 5 * S },
  ]);
  s.junctions.j = junction(s, "j", "A", "B", S / 2);
  return s;
}

describe("junction lookups", () => {
  it("finds the junction between two clips and those of a clip", () => {
    const s = joined();
    expect(junctionBetween(s, "A", "B")?.id).toBe("j");
    expect(junctionBetween(s, "B", "A")).toBeUndefined();
    expect(junctionsOfClip(s, "B").map((j) => j.id)).toEqual(["j"]);
    expect(junctionsOfClip(s, "u")).toEqual([]);
  });
});

describe("allowedOverlap", () => {
  it("returns the junction duration for the joined pair and 0 otherwise", () => {
    const s = joined();
    expect(allowedOverlap(s, s.clips.A!, s.clips.B!)).toBe(S / 2);
    expect(allowedOverlap(s, s.clips.B!, s.clips.A!)).toBe(0);
  });

  it("covers the linked sound pair of a picture junction", () => {
    const s = joined();
    expect(allowedOverlap(s, s.clips.a!, s.clips.b!)).toBe(S / 2);
    expect(allowedOverlap(s, s.clips.a!, s.clips.u!)).toBe(0);
  });
});

describe("rippleMoves", () => {
  it("moves the clip, later clips on its track and their partners, not other tracks", () => {
    const s = state([
      { id: "p", track: 0, start: 0 },
      { id: "A", track: 0, start: S, linkId: "l" },
      { id: "B", track: 0, start: 2 * S },
      { id: "a", track: 1, start: S, linkId: "l" },
      { id: "o", track: 1, start: 9 * S },
    ]);
    const moves = rippleMoves(s, "A", 100);
    expect(moves.sort((x, y) => (x.clipId < y.clipId ? -1 : 1))).toEqual([
      { clipId: "A", start: S + 100 },
      { clipId: "B", start: 2 * S + 100 },
      { clipId: "a", start: S + 100 },
    ]);
  });
});

describe("findLayoutConflict", () => {
  const pair = (overlap: number) => {
    const s = state([
      { id: "A", track: 0, start: 0 },
      { id: "B", track: 0, start: S - overlap },
    ]);
    s.junctions.j = junction(s, "j", "A", "B", S / 2);
    return s;
  };

  it("accepts an overlap equal to the junction and rejects 1 µs more or less", () => {
    expect(findLayoutConflict(pair(S / 2))).toBeUndefined();
    expect(findLayoutConflict(pair(S / 2 + 1))?.clip.id).toBe("A");
    expect(findLayoutConflict(pair(S / 2 - 1))?.other.id).toBe("B");
  });

  it("accepts the linked sound overlap and rejects a clip overlapping a non-adjacent one", () => {
    expect(findLayoutConflict(joined())).toBeUndefined();
    const s = state([
      { id: "A", track: 0, start: 0, duration: 5 * S },
      { id: "B", track: 0, start: S },
      { id: "C", track: 0, start: 2 * S },
    ]);
    expect(findLayoutConflict(s)?.clip.id).toBe("A");
  });

  it("reports a negative start", () => {
    const s = state([{ id: "A", track: 0, start: -1 }]);
    expect(findLayoutConflict(s)?.clip.id).toBe("A");
  });
});

describe("staleJunctions", () => {
  it("finds missing clips, different tracks, and wrong overlap", () => {
    const s = joined();
    expect(staleJunctions(s)).toEqual([]);
    s.junctions.gone = junction(s, "gone", "A", "zz", 0);
    s.junctions.cross = junction(s, "cross", "A", "b", S / 2);
    s.junctions.wrong = junction(s, "wrong", "A", "B", S / 4);
    expect(staleJunctions(s).sort()).toEqual(["cross", "gone", "wrong"]);
  });
});

describe("applyMoves", () => {
  it("keeps clipIds sorted by start and leaves the input untouched", () => {
    const s = state([
      { id: "A", track: 0, start: 0 },
      { id: "B", track: 0, start: 2 * S },
    ]);
    const j = junction(s, "j", "A", "B", 0);
    const next = applyMoves(s, [{ clipId: "A", start: 5 * S }], { j });
    expect(next.tracks[next.compositions.c1!.trackOrder[0]!]!.clipIds).toEqual(["B", "A"]);
    expect(next.clips.A!.start).toBe(5 * S);
    expect(next.junctions.j).toEqual(j);
    expect(s.clips.A!.start).toBe(0);
    expect(s.tracks[s.compositions.c1!.trackOrder[0]!]!.clipIds).toEqual(["A", "B"]);
    expect(s.junctions.j).toBeUndefined();
    expect(applyMoves(next, [], { j: null }).junctions.j).toBeUndefined();
  });
});
