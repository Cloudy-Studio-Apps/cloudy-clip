import { describe, expect, it } from "vitest";
import { seedProject, type Clip, type MediaAsset, type ProjectState } from "@/modules/project";
import { DEFAULT_SOUND } from "@/modules/project";
import { mixdown } from "./mixdown";

const media = (id: string): MediaAsset => ({
  id,
  name: `${id}.mp4`,
  path: `/${id}.mp4`,
  kind: "video",
  size: 1,
});

const clip = (id: string, trackId: string, extra: Partial<Clip> = {}): Clip => ({
  id,
  trackId,
  kind: "media",
  mediaId: "m",
  start: 0,
  sourceIn: 0,
  duration: 4_000_000,
  props: {},
  ...extra,
});

const everything = { start: 0, duration: 10_000_000 };
const sounds = () => true;

function project(clips: Clip[], muted = false): ProjectState {
  const state = seedProject({
    tracks: {
      a1: {
        id: "a1",
        kind: "audio",
        name: "A1",
        clipIds: clips.filter((c) => c.trackId === "a1").map((c) => c.id),
        muted,
        hidden: false,
      },
    },
    clips: Object.fromEntries(clips.map((c) => [c.id, c])),
    media: { m: media("m"), n: media("n") },
  });
  return state;
}

describe("mixdown", () => {
  const fast = { rate: 2, pitchCorrection: true, reversed: false };

  it("gives a clip at 2x its time in the file and its rate", () => {
    const state = project([clip("a", "a1", { sourceIn: 1_000_000, speed: fast })]);
    const window = { start: 1_000_000, duration: 2_000_000 };
    expect(mixdown(state, "c1", window, sounds)[0]).toMatchObject({
      from: 3_000_000,
      duration: 2_000_000,
      speed: 2,
    });
  });

  it("says when a clip's pitch moves with its speed", () => {
    const speed = { ...fast, pitchCorrection: false };
    const state = project([clip("a", "a1", { speed })]);
    expect(mixdown(state, "c1", everything, sounds)[0]).toMatchObject({ keepPitch: false });
  });

  it("reads a reversed clip's stretch from its earliest moment in the file", () => {
    const speed = { rate: 1, pitchCorrection: true, reversed: true };
    const state = project([clip("a", "a1", { speed })]);
    const window = { start: 1_000_000, duration: 1_000_000 };
    expect(mixdown(state, "c1", window, sounds)[0]).toMatchObject({
      from: 2_000_000,
      reversed: true,
    });
  });

  it("adds no speed at 1x", () => {
    const state = project([clip("a", "a1")]);
    const [segment] = mixdown(state, "c1", everything, sounds);
    expect(segment).not.toHaveProperty("speed");
    expect(segment).not.toHaveProperty("keepPitch");
  });

  it("leaves out disabled clips", () => {
    const state = project([clip("a", "a1", { disabled: true })]);
    expect(mixdown(state, "c1", everything, sounds)).toEqual([]);
  });

  it("places a clip at its timeline time and file offset", () => {
    const state = project([clip("a", "a1", { start: 1_000_000, sourceIn: 2_000_000 })]);
    expect(mixdown(state, "c1", everything, sounds)).toEqual([
      {
        path: "/m.mp4",
        at: 1_000_000,
        from: 2_000_000,
        duration: 4_000_000,
        fadeIn: 0,
        fadeOut: 0,
      },
    ]);
  });

  it("a clip at -6 dB exports at half gain with its own fades", () => {
    const sound = { ...DEFAULT_SOUND, volumeDb: -6, fadeIn: 500_000, fadeOut: 250_000 };
    const [segment] = mixdown(project([clip("a", "a1", { sound })]), "c1", everything, sounds);
    expect(segment!.gain).toBeCloseTo(0.501, 3);
    expect(segment).toMatchObject({ fadeIn: 500_000, fadeOut: 250_000 });
  });

  it("leaves out muted tracks, at any depth", () => {
    expect(mixdown(project([clip("a", "a1")], true), "c1", everything, sounds)).toEqual([]);
    const state = withPlacement(project([]), { innerMuted: true });
    expect(mixdown(state, "c1", everything, sounds)).toEqual([]);
  });

  it("offsets sound inside a placed composition by its own in-point", () => {
    const state = withPlacement(project([]), { innerMuted: false });
    expect(mixdown(state, "c1", everything, sounds)).toEqual([
      {
        path: "/n.mp4",
        at: 2_000_000,
        from: 1_000_000,
        duration: 2_000_000,
        fadeIn: 0,
        fadeOut: 0,
      },
    ]);
  });

  it("doesn't fade a clip into a disabled neighbour, as the preview doesn't", () => {
    const left = clip("l", "a1", { disabled: true });
    const right = clip("r", "a1", { start: 3_000_000 });
    const state = project([left, right]);
    state.junctions.j = {
      id: "j",
      kind: "dissolve",
      trackId: "a1",
      leftClipId: "l",
      rightClipId: "r",
      duration: 1_000_000,
      props: {},
    };
    expect(mixdown(state, "c1", everything, sounds)).toMatchObject([{ fadeIn: 0 }]);
  });

  it("gives clips under a junction an equal-power crossfade", () => {
    const left = clip("l", "a1");
    const right = clip("r", "a1", { start: 3_000_000 });
    const state = project([left, right]);
    state.junctions.j = {
      id: "j",
      kind: "dissolve",
      trackId: "a1",
      leftClipId: "l",
      rightClipId: "r",
      duration: 1_000_000,
      props: {},
    };
    const [a, b] = mixdown(state, "c1", everything, sounds);
    expect(a).toMatchObject({ at: 0, fadeIn: 0, fadeOut: 1_000_000 });
    expect(b).toMatchObject({ at: 3_000_000, fadeIn: 1_000_000, fadeOut: 0 });
  });

  it("cuts a segment to the export range", () => {
    const state = project([clip("a", "a1", { sourceIn: 500_000 })]);
    const range = { start: 1_000_000, duration: 2_000_000 };
    expect(mixdown(state, "c1", range, sounds)).toEqual([
      {
        path: "/m.mp4",
        at: 0,
        from: 1_500_000,
        duration: 2_000_000,
        fadeIn: 0,
        fadeOut: 0,
      },
    ]);
  });

  it("skips files without sound", () => {
    const state = project([clip("a", "a1")]);
    expect(mixdown(state, "c1", everything, () => false)).toEqual([]);
  });
});

/** Puts composition `c2`, 5 s long with one 4 s sound clip of `n`, at 2 s of `c1` from its 1 s. */
function withPlacement(state: ProjectState, { innerMuted }: { innerMuted: boolean }) {
  const inner = clip("inner", "a2", { mediaId: "n", duration: 3_000_000 });
  state.compositions.c2 = {
    ...state.compositions.c1!,
    id: "c2",
    duration: 5_000_000,
    trackOrder: ["a2"],
  };
  state.tracks.a2 = {
    id: "a2",
    compositionId: "c2",
    kind: "audio",
    name: "A2",
    clipIds: ["inner"],
    muted: innerMuted,
    hidden: false,
  };
  state.clips.inner = inner;
  state.clips.place = clip("place", "a1", {
    kind: "composition",
    mediaId: undefined,
    compositionRef: "c2",
    start: 2_000_000,
    sourceIn: 1_000_000,
    duration: 2_000_000,
  });
  state.tracks.a1!.clipIds = ["place"];
  return state;
}
