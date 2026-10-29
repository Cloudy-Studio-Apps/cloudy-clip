import { describe, expect, it } from "vitest";
import { createEmptyProject, type Junction, type ProjectState } from "@/modules/project";
import { activeJunctions, crossfadeGains, soundGains } from "./junctions";

const S = 1_000_000;

/**
 * Pictures A (0–2 s) and B (1.5–3.5 s) on the video track joined by a 0.5 s junction; their
 * linked sounds a and b overlap the same way on the audio track.
 */
function joined(): ProjectState {
  const s = createEmptyProject();
  const [video, audio] = [s.trackOrder[0]!, s.trackOrder[1]!];
  const clip = (id: string, trackId: string, start: number, linkId: string) => {
    s.clips[id] = {
      id,
      trackId,
      kind: "media",
      props: {},
      start,
      sourceIn: 0,
      duration: 2 * S,
      linkId,
    };
    s.tracks[trackId]!.clipIds.push(id);
  };
  clip("A", video, 0, "la");
  clip("B", video, 1.5 * S, "lb");
  clip("a", audio, 0, "la");
  clip("b", audio, 1.5 * S, "lb");
  const junction: Junction = {
    id: "J",
    kind: "crossfade",
    trackId: video,
    leftClipId: "A",
    rightClipId: "B",
    duration: 0.5 * S,
    props: {},
  };
  s.junctions.J = junction;
  return s;
}

describe("activeJunctions", () => {
  it("gives progress 0 at the overlap start and 0.5 halfway", () => {
    const s = joined();
    const video = s.trackOrder[0]!;
    const atStart = activeJunctions(s, video, 1.5 * S);
    expect(atStart.map((a) => [a.junction.id, a.progress, a.elapsed])).toEqual([["J", 0, 0]]);
    const halfway = activeJunctions(s, video, 1.75 * S);
    expect(halfway.map((a) => [a.junction.id, a.progress, a.elapsed])).toEqual([["J", 0.5, 0.25]]);
  });

  it("none outside the overlap", () => {
    const s = joined();
    const video = s.trackOrder[0]!;
    expect(activeJunctions(s, video, 1.4 * S)).toEqual([]);
    expect(activeJunctions(s, video, 2 * S)).toEqual([]);
    expect(activeJunctions(s, s.trackOrder[1]!, 1.75 * S)).toEqual([]);
  });

  it("ignores junctions that don't overlap", () => {
    const s = joined();
    s.junctions.J = { ...s.junctions.J!, duration: 0 };
    expect(activeJunctions(s, s.trackOrder[0]!, 1.5 * S)).toEqual([]);
  });
});

describe("crossfadeGains", () => {
  it("crossfadeGains is equal power (left² + right² = 1) and 1/0 at the ends", () => {
    for (const p of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
      const { left, right } = crossfadeGains(p);
      expect(left ** 2 + right ** 2).toBeCloseTo(1, 10);
    }
    expect(crossfadeGains(0)).toEqual({ left: 1, right: 0 });
    const end = crossfadeGains(1);
    expect(end.left).toBeCloseTo(0, 10);
    expect(end.right).toBe(1);
  });

  it("clamps progress to 0..1", () => {
    expect(crossfadeGains(-1)).toEqual(crossfadeGains(0));
    expect(crossfadeGains(2)).toEqual(crossfadeGains(1));
  });
});

describe("soundGains", () => {
  it("crossfades the linked sound pair under a junction", () => {
    const s = joined();
    const gains = soundGains(s, 1.75 * S);
    const { left, right } = crossfadeGains(0.5);
    expect(gains.get("a")).toBeCloseTo(left, 10);
    expect(gains.get("b")).toBeCloseTo(right, 10);
    expect(gains.has("A")).toBe(false);
  });

  it("leaves sounds alone outside the overlap", () => {
    expect(soundGains(joined(), 1 * S).size).toBe(0);
    expect(soundGains(joined(), 2.5 * S).size).toBe(0);
  });
});
