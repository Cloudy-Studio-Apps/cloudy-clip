import { describe, expect, it } from "vitest";
import type { Clip, Composition, ProjectState, Track } from "@/modules/project";
import type { ResolvedClip, ResolvedFrame } from "../engine/engine.types";
import { resolveFrame } from "./frame";

const S = 1_000_000;
const opts = { pictureOnly: false, preloadAhead: 1.5 * S };

function track(id: string, compositionId: string, clipIds: string[], extra: Partial<Track> = {}) {
  return {
    id,
    compositionId,
    kind: "video",
    name: id,
    clipIds,
    muted: false,
    hidden: false,
    ...extra,
  } satisfies Track;
}

function composition(id: string, trackOrder: string[]): Composition {
  return {
    id,
    name: id,
    format: { width: 100, height: 100, fps: 30 },
    background: "#000000",
    duration: 60 * S,
    extendToFit: false,
    trackOrder,
  };
}

function clip(
  id: string,
  trackId: string,
  start: number,
  duration: number,
  extra: Partial<Clip> = {},
) {
  return {
    id,
    trackId,
    kind: "media",
    mediaId: "m",
    start,
    sourceIn: 0,
    duration,
    props: {},
    ...extra,
  };
}

const placement = (id: string, trackId: string, start: number, extra: Partial<Clip> = {}) =>
  clip(id, trackId, start, 10 * S, {
    kind: "composition",
    mediaId: undefined,
    compositionRef: "inner",
    ...extra,
  });

/** `outer` with the given tracks and clips, playing `inner`, which holds `x` from 0 for 60 s. */
function project(
  tracks: Track[],
  clips: Clip[],
  innerClip = clip("x", "ix", 0, 60 * S),
): ProjectState {
  return {
    compositions: {
      outer: composition(
        "outer",
        tracks.map((t) => t.id),
      ),
      inner: composition("inner", ["ix"]),
    },
    compositionOrder: ["outer", "inner"],
    mainCompositionId: "outer",
    media: {},
    mediaOrder: [],
    tracks: {
      ...Object.fromEntries(tracks.map((t) => [t.id, t])),
      ix: track("ix", "inner", [innerClip.id]),
    },
    clips: { ...Object.fromEntries(clips.map((c) => [c.id, c])), [innerClip.id]: innerClip },
    junctions: {},
  };
}

const innerClips = (frame: ResolvedFrame): ResolvedClip[] =>
  frame.tracks.flatMap((t) =>
    t.clips.flatMap((c) => c.inner?.tracks.flatMap((i) => i.clips) ?? []),
  );

describe("resolveFrame", () => {
  it("descends with local time", () => {
    const state = project(
      [track("v", "outer", ["p"])],
      [placement("p", "v", 2 * S, { sourceIn: S })],
    );
    const [x] = innerClips(resolveFrame(state, "outer", 3 * S, opts));
    expect(x!.time).toBe(2 * S);
  });

  it("gives two placements of one composition their own paths and times", () => {
    const state = project(
      [track("v1", "outer", ["p1"]), track("v2", "outer", ["p2"])],
      [placement("p1", "v1", 0), placement("p2", "v2", 2 * S)],
    );
    const [a, b] = innerClips(resolveFrame(state, "outer", 3 * S, opts));
    expect([a!.path, b!.path]).toEqual(["p1/x", "p2/x"]);
    expect([a!.time, b!.time]).toEqual([3 * S, S]);
  });

  it("stops at a composition's length", () => {
    const state = project([track("v", "outer", ["p"])], [placement("p", "v", 0)]);
    state.compositions.inner!.duration = 2 * S;
    expect(innerClips(resolveFrame(state, "outer", 3 * S, opts))).toEqual([]);
  });
});
