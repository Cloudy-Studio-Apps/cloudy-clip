import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKernel, defineModule, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { createFakeFontsModule } from "@/modules/fonts";
import { previewModule } from "@/modules/preview";
import { createProjectModule, projectRef, seedProject, type Clip } from "@/modules/project";
import { timelineModule } from "@/modules/timeline";
import { createSilenceFinder } from "./sound.silence";
import { soundRef } from "./sound.ref";
import type { SoundApi } from "./sound.types";
import { findFileSilences } from "./sound.service";
import { stripSilence } from "./sound.tools.commands";

// The sound module needs the whole app to set up; this command needs only its silence finder.
const sound = defineModule({
  ref: soundRef,
  name: "Sound",
  commands: [stripSilence],
  setup({ require }) {
    const silences = createSilenceFinder(require(projectRef).store.getState);
    return { api: { silences } as SoundApi };
  },
});

vi.mock("./sound.service", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  findFileSilences: vi.fn(),
}));

const S = 1_000_000;
let kernel: Kernel;
const state = () => kernel.modules.require(projectRef).store.getState();
const run = (input: unknown) => kernel.bus.run(stripSilence, input as never);
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
async function load(clips: Clip[]) {
  kernel = await createKernel();
  const project = seedProject({ clips: Object.fromEntries(clips.map((c) => [c.id, c])) });
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
    sound,
  ]);
}

beforeEach(() => {
  vi.mocked(findFileSilences).mockReset();
});

describe("sound.stripSilence", () => {
  it("keeps stretches shorter than the minimum and the padding of quiet around a cut", async () => {
    await load([clip({ id: "a" })]);
    vi.mocked(findFileSilences).mockResolvedValue([
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
    vi.mocked(findFileSilences).mockResolvedValue([[4 * S, 8 * S]]);
    await run({ clipIds: ["a"], padMs: 0 });
    // File 4 s..8 s at 2x is timeline 4 s..6 s: a gap of 2 s is left.
    expect(spans("a1")).toEqual([
      [2 * S, 4 * S],
      [6 * S, 7 * S],
    ]);
  });

  it("closes the gaps: what follows moves left by the time removed", async () => {
    await load([
      clip({ id: "a", duration: 4 * S }),
      clip({ id: "b", start: 4 * S, duration: 3 * S }),
    ]);
    vi.mocked(findFileSilences).mockResolvedValue([[S, 2 * S]]);
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
    vi.mocked(findFileSilences).mockResolvedValue([[2 * S, 4 * S]]);
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
    vi.mocked(findFileSilences).mockResolvedValue([[2 * S, 4 * S]]);
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
    vi.mocked(findFileSilences).mockResolvedValue([]);
    expect(await run({ clipIds: ["a"] })).toMatchObject({
      ok: false,
      error: { code: "sound.no_silence" },
    });
    expect(state()).toBe(before);
  });
});
