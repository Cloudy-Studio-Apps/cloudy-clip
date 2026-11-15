import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { mediaRef } from "@/modules/media";
import { elementModule } from "@/modules/element";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { createFakeFontsModule } from "@/modules/fonts";
import { previewModule } from "@/modules/preview";
import {
  createProjectModule,
  projectRef,
  seedProject,
  DEFAULT_SOUND,
  type Clip,
  type KeyTrack,
  type ProjectState,
} from "@/modules/project";
import { timelineModule } from "@/modules/timeline";
import { SILENCE_DEFAULTS } from "./logic/silence";
import { createSilenceFinder } from "./sound.silence";
import { soundRef } from "./sound.ref";
import type { SoundApi } from "./sound.types";
import { beginLoudness, beginSilences, finishLoudness, finishSilences } from "./sound.service";
import { matchLevel, stripSilence } from "./sound.tools.commands";
import { createLoudnessMeter } from "./sound.loudness";
import { audioModule, setSound } from "@/modules/audio";
import { keyframeModule } from "@/modules/keyframe";

/** Stands in for the inspector, which audio and keyframe need only for their panels. */
const inspector = defineModule({
  ref: defineModuleRef<Record<string, never>>("inspector"),
  name: "inspector",
  tier: "feature",
  commands: [],
  mcpTools: [],
  setup: () => ({ api: {} }),
});

// The sound module needs the whole app to set up; this command needs only its silence finder.
const sound = defineModule({
  ref: soundRef,
  name: "Sound",
  commands: [stripSilence, matchLevel],
  setup({ require }) {
    const silences = createSilenceFinder(require(projectRef).store.getState, require(mediaRef));
    const loudness = createLoudnessMeter(require(projectRef).store.getState, require(mediaRef));
    return { api: { silences, loudness } as SoundApi };
  },
});

vi.mock("./sound.service", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  beginSilences: vi.fn(async () => "scan"),
  finishSilences: vi.fn(),
  beginLoudness: vi.fn(async () => "measure"),
  finishLoudness: vi.fn(),
}));

const S = 1_000_000;
let kernel: Kernel;
const state = () => kernel.modules.require(projectRef).store.getState();
/** Scans as the dialog does, then strips: the command only uses a scan that was made. */
async function run(input: { clipIds: string[] } & Record<string, unknown>, scan = true) {
  if (scan) {
    await kernel.modules
      .require(soundRef)
      .silences.scan(input.clipIds, { ...SILENCE_DEFAULTS, ...input });
  }
  return kernel.bus.run(stripSilence, input as never);
}
/** What the scan finds in every file. */
const found = (stretches: [number, number][]) =>
  vi.mocked(finishSilences).mockResolvedValue(stretches);
/** The clips of a track as [start, end] pairs, in order. */
const spans = (trackId: string) =>
  state().tracks[trackId]!.clipIds.map((id) => [
    state().clips[id]!.start,
    state().clips[id]!.start + state().clips[id]!.duration,
  ]);

const clip = (over: Partial<Clip>): Clip => ({
  id: "x",
  trackId: "a1",
  kind: "media",
  mediaId: "ma",
  start: 0,
  sourceIn: 0,
  duration: 10 * S,
  props: {},
  ...over,
});

/** A project with these clips, each on its track's list. */
async function load(clips: Clip[], junctions: ProjectState["junctions"] = {}) {
  kernel = await createKernel();
  const project = seedProject({
    clips: Object.fromEntries(clips.map((c) => [c.id, c])),
    junctions,
  });
  project.media.ma = { id: "ma", name: "a.mp3", path: "/a.mp3", kind: "audio", size: 1 };
  project.media.mv = { id: "mv", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.mediaOrder = ["ma", "mv"];
  for (const c of clips) project.tracks[c.trackId]!.clipIds.push(c.id);
  await kernel.modules.loadAll([
    createProjectModule(project),
    elementModule,
    junctionModule,
    createFakeMediaModule({
      ma: { status: "ready", duration: 60 * S },
      mv: { status: "ready", duration: 60 * S, width: 1920, height: 1080 },
    }),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    inspector,
    audioModule,
    keyframeModule,
    sound,
  ]);
}

beforeEach(() => {
  vi.mocked(finishSilences).mockReset();
  vi.mocked(beginSilences).mockClear();
});

describe("sound.stripSilence", () => {
  it("keeps stretches shorter than the minimum and the padding of quiet around a cut", async () => {
    await load([clip({ id: "a" })]);
    found([
      [S, S + 300_000],
      [4 * S, 6 * S],
    ]);
    const result = await run({ clipIds: ["a"], minMs: 500, padMs: 100 });
    expect(result).toMatchObject({ ok: true, value: { cuts: 1, removed: 1_800_000 } });
    expect(spans("a1")).toEqual([
      [0, 4_100_000],
      [6 * S - 100_000, 10 * S],
    ]);
  });

  it("maps a sped-up clip's silence through the speed", async () => {
    await load([
      clip({
        id: "a",
        start: 2 * S,
        sourceIn: 0,
        duration: 5 * S,
        speed: { rate: 2, pitchCorrection: true, reversed: false },
      }),
    ]);
    found([[4 * S, 8 * S]]);
    await run({ clipIds: ["a"], padMs: 0 });
    // File 4 s..8 s at 2x is timeline 4 s..6 s: a gap of 2 s is left.
    expect(spans("a1")).toEqual([
      [2 * S, 4 * S],
      [6 * S, 7 * S],
    ]);
  });

  it("flips a reversed clip's silence: the file's end plays first", async () => {
    await load([clip({ id: "a", speed: { rate: 1, pitchCorrection: true, reversed: true } })]);
    found([[8 * S, 12 * S]]);
    await run({ clipIds: ["a"], padMs: 0 });
    expect(spans("a1")).toEqual([[2 * S, 10 * S]]);
  });

  it("closes the gaps: what follows moves left by the time removed", async () => {
    await load([
      clip({ id: "a", duration: 4 * S }),
      clip({ id: "b", start: 4 * S, duration: 3 * S }),
    ]);
    found([[S, 2 * S]]);
    await run({ clipIds: ["a"], padMs: 0, closeGaps: true });
    expect(spans("a1")).toEqual([
      [0, S],
      [S, 3 * S],
      [3 * S, 6 * S],
    ]);
  });

  it("cuts a video's sound alone on the Sound page, leaving its picture, in one undo step", async () => {
    await load([
      clip({ id: "v", trackId: "v1", mediaId: "mv", linkId: "l" }),
      clip({ id: "s", mediaId: "mv", linkId: "l" }),
    ]);
    const before = state();
    found([[2 * S, 4 * S]]);
    const result = await run({ clipIds: ["s", "v"], padMs: 0, soundOnly: true });
    expect(result).toMatchObject({ ok: true });
    expect(state().clips.v).toMatchObject({ start: 0, duration: 10 * S });
    expect(spans("a1")).toEqual([
      [0, 2 * S],
      [4 * S, 10 * S],
    ]);
    kernel.history.undo();
    expect(state()).toEqual(before);
  });

  it("cuts picture and sound together on a video", async () => {
    await load([
      clip({ id: "v", trackId: "v1", mediaId: "mv", linkId: "l" }),
      clip({ id: "s", mediaId: "mv", linkId: "l" }),
    ]);
    found([[2 * S, 4 * S]]);
    await run({ clipIds: ["v"], padMs: 0, closeGaps: true });
    expect(spans("v1")).toEqual(spans("a1"));
    expect(spans("a1")).toEqual([
      [0, 2 * S],
      [2 * S, 8 * S],
    ]);
  });

  it("changes nothing when no silence is found", async () => {
    await load([clip({ id: "a" })]);
    const before = state();
    found([]);
    expect(await run({ clipIds: ["a"] })).toMatchObject({
      ok: false,
      error: { code: "sound.no_silence" },
    });
    expect(state()).toBe(before);
  });

  it("refuses to scan itself: without a scan it fails and changes nothing", async () => {
    await load([clip({ id: "a" })]);
    const before = state();
    expect(await run({ clipIds: ["a"] }, false)).toMatchObject({
      ok: false,
      error: { code: "sound.silences_missing" },
    });
    expect(beginSilences).not.toHaveBeenCalled();
    expect(state()).toBe(before);
  });

  describe("with a transition between two clips", () => {
    // A 0..5 s and B 4..10 s overlap under a 1 s junction.
    const join = () =>
      load([clip({ id: "A", duration: 5 * S }), clip({ id: "B", start: 4 * S, duration: 6 * S })], {
        j: {
          id: "j",
          kind: "test.dissolve",
          trackId: "a1",
          leftClipId: "A",
          rightClipId: "B",
          duration: S,
          props: {},
        },
      });

    it("strips both clips outside the overlap, keeping the junction", async () => {
      await join();
      found([[2 * S, 3 * S]]);
      const before = state();
      const result = await run({ clipIds: ["A", "B"], padMs: 0 });
      expect(result).toMatchObject({ ok: true, value: { cuts: 2 } });
      expect(state().junctions.j).toBeDefined();
      kernel.history.undo();
      expect(state()).toEqual(before);
    });

    it("rolls the whole strip back when a cut falls inside the overlap", async () => {
      await join();
      // 4.2 s..4.8 s is inside the overlap in A; B's cuts come first (latest first) and are fine.
      found([
        [3 * S, 4 * S],
        [4.2 * S, 4.8 * S],
      ]);
      const before = state();
      const result = await run({ clipIds: ["A", "B"], padMs: 0 });
      expect(result).toMatchObject({ ok: false, error: { code: "junction.split_in_overlap" } });
      expect(state()).toEqual(before);
    });
  });
});

describe("sound.matchLevel", () => {
  /** Measures as the dialog does (each file's loudness by its path), then matches. */
  async function match(input: { clipIds: string[]; targetLufs?: number }, measure = true) {
    if (measure) await kernel.modules.require(soundRef).loudness.measure(input.clipIds);
    return kernel.bus.run(matchLevel, input);
  }
  const loudness = (byPath: Record<string, number | null>) => {
    vi.mocked(beginLoudness).mockImplementation(async (path) => `m:${path}`);
    vi.mocked(finishLoudness).mockImplementation(async (id) => byPath[id.slice(2)] ?? null);
  };
  const volumes = () =>
    Object.fromEntries(Object.values(state().clips).map((c) => [c.id, c.sound?.volumeDb ?? 0]));

  it("brings two clips to the loudest, a volume that differs by their difference", async () => {
    await load([clip({ id: "a" }), clip({ id: "b", mediaId: "mv", start: 10 * S })]);
    loudness({ "/a.mp3": -20, "/a.mp4": -26 });
    const result = await match({ clipIds: ["a", "b"] });
    expect(result).toMatchObject({ ok: true, value: { target: -20 } });
    expect(volumes()).toEqual({ a: 0, b: 6 });
  });

  it("adds the change to the volume the clip already has", async () => {
    await load([clip({ id: "a", sound: { ...DEFAULT_SOUND, volumeDb: 3 } })]);
    loudness({ "/a.mp3": -23 });
    await match({ clipIds: ["a"], targetLufs: -20 });
    expect(volumes().a).toBe(6);
  });

  it("makes a measurement stale when the clip's volume changes", async () => {
    await load([clip({ id: "a" })]);
    loudness({ "/a.mp3": -23 });
    await kernel.modules.require(soundRef).loudness.measure(["a"]);
    await kernel.bus.run(setSound, { clipIds: ["a"], patch: { volumeDb: -3 } });
    const result = await match({ clipIds: ["a"], targetLufs: -20 }, false);
    expect(result).toMatchObject({ ok: false, error: { code: "sound.levels_missing" } });
  });

  it("stops at the volume range and says so", async () => {
    await load([clip({ id: "a" }), clip({ id: "b", mediaId: "mv", start: 10 * S })]);
    loudness({ "/a.mp3": -10, "/a.mp4": -40 });
    const result = await match({ clipIds: ["a", "b"] });
    expect(volumes().b).toBe(12);
    expect(result).toMatchObject({ value: { changes: [{}, { clamped: true }] } });
  });

  it("moves every volume key by the same dB, as one undo step", async () => {
    const keys: KeyTrack = {
      blend: "number",
      min: -60,
      max: 12,
      keys: [
        { id: "k1", t: 0, value: 0, ease: { kind: "linear" } },
        { id: "k2", t: 5 * S, value: -12, ease: { kind: "linear" } },
      ],
    };
    await load([
      clip({ id: "a", animation: { "sound.volumeDb": keys } }),
      clip({ id: "b", mediaId: "mv", start: 10 * S }),
    ]);
    loudness({ "/a.mp3": -26, "/a.mp4": -20 });
    const before = state();
    await match({ clipIds: ["a", "b"] });
    expect(state().clips.a!.animation!["sound.volumeDb"]!.keys.map((k) => k.value)).toEqual([
      6, -6,
    ]);
    kernel.history.undo();
    expect(state()).toEqual(before);
  });

  it("refuses without a measurement, and never measures itself", async () => {
    await load([clip({ id: "a" })]);
    vi.mocked(beginLoudness).mockClear();
    const result = await match({ clipIds: ["a"] }, false);
    expect(result).toMatchObject({ ok: false, error: { code: "sound.levels_missing" } });
    expect(beginLoudness).not.toHaveBeenCalled();
  });

  it("leaves silent clips and clips with no sound alone, and names them", async () => {
    await load([
      clip({ id: "a" }),
      clip({ id: "b", mediaId: "mv", start: 10 * S }),
      clip({ id: "t", kind: "text", mediaId: undefined, trackId: "v1", start: 20 * S }),
    ]);
    loudness({ "/a.mp3": -20, "/a.mp4": null });
    const result = await match({ clipIds: ["a", "b", "t"], targetLufs: -23 });
    expect(result).toMatchObject({
      ok: true,
      value: { changes: [{ clipId: "a" }], skipped: [{ clipId: "b" }, { clipId: "t" }] },
    });
    expect(volumes().a).toBe(-3);
  });
});
