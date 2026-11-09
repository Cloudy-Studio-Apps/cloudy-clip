import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { createFakeFontsModule } from "@/modules/fonts";
import { previewModule } from "@/modules/preview";
import { createProjectModule, projectRef, seedProject, trackValue } from "@/modules/project";
import { addClip, moveClip, timelineModule } from "@/modules/timeline";
import { passSpans, returnToLine } from "./logic/automation";
import { soundModule } from "./sound.module";
import { setTrackMix } from "./sound.mix.commands";
import {
  moveLineKeys,
  removeLineKeys,
  setLineKey,
  writePass,
  writePasses,
} from "./sound.line.commands";

const S = 1_000_000;
let kernel: Kernel;
const state = () => kernel.modules.require(projectRef).store.getState();
const run = (command: Parameters<Kernel["bus"]["run"]>[0], input: unknown) =>
  kernel.bus.run(command, input as never);
const line = () => state().tracks.a1!.mix?.volumeLine;
const keys = () => (line()?.keys ?? []).map((key) => [key.t, key.value]);

async function ok(command: Parameters<Kernel["bus"]["run"]>[0], input: unknown) {
  const result = await run(command, input);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

beforeEach(async () => {
  kernel = await createKernel();
  const project = seedProject();
  project.media.ma = { id: "ma", name: "a.mp3", path: "/a.mp3", kind: "audio", size: 1 };
  project.mediaOrder = ["ma"];
  await kernel.modules.loadAll([
    createProjectModule(project),
    elementModule,
    junctionModule,
    createFakeMediaModule({ ma: { status: "ready", duration: 60 * S } }),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    soundModule,
  ]);
});

describe("track volume line", () => {
  it("is a number track in range that holds before the first key and after the last", async () => {
    await ok(setLineKey, { trackId: "a1", at: 2 * S, db: -6 });
    await ok(setLineKey, { trackId: "a1", at: 4 * S, db: -18 });
    const track = line()!;
    expect(track).toMatchObject({ blend: "number", min: -60, max: 12 });
    expect(trackValue(track, 0)).toBe(-6);
    expect(trackValue(track, 3 * S)).toBe(-12);
    expect(trackValue(track, 9 * S)).toBe(-18);
  });

  it("refuses a value out of range, a video track and a missing one", async () => {
    const high = await run(setLineKey, { trackId: "a1", at: 0, db: 13 });
    expect(high).toMatchObject({ ok: false });
    expect(line()).toBeUndefined();
    const video = await run(setLineKey, { trackId: "v1", at: 0, db: 0 });
    expect(video).toMatchObject({ ok: false, error: { code: "sound.not_audio" } });
    const missing = await run(setLineKey, { trackId: "nope", at: 0, db: 0 });
    expect(missing).toMatchObject({ ok: false, error: { code: "sound.track_not_found" } });
    await ok(setLineKey, { trackId: "a1", at: 0, db: 0 });
    const far = await run(moveLineKeys, {
      trackId: "a1",
      keyIds: [line()!.keys[0]!.id],
      delta: 0,
      deltaDb: 20,
    });
    expect(far).toMatchObject({ ok: false, error: { code: "sound.invalid_value" } });
  });

  it("moves keys in time and level, and drops the line with its last key", async () => {
    await ok(setLineKey, { trackId: "a1", at: S, db: -6 });
    await ok(setLineKey, { trackId: "a1", at: 3 * S, db: -12 });
    const [first, second] = line()!.keys;
    await ok(moveLineKeys, { trackId: "a1", keyIds: [first!.id], delta: S, deltaDb: 3 });
    expect(keys()).toEqual([
      [2 * S, -3],
      [3 * S, -12],
    ]);
    await ok(removeLineKeys, { trackId: "a1", keyIds: [first!.id] });
    await ok(removeLineKeys, { trackId: "a1", keyIds: [second!.id] });
    expect(state().tracks.a1!.mix).toBeUndefined();
    kernel.history.undo();
    expect(keys()).toEqual([[3 * S, -12]]);
  });

  it("stays put when a clip moves, and rides along with the mix", async () => {
    const { clips } = (await ok(addClip, { mediaId: "ma" })) as { clips: { id: string }[] };
    await ok(setLineKey, { trackId: "a1", at: S, db: -6 });
    await ok(setTrackMix, { trackId: "a1", volumeDb: -3 });
    const before = structuredClone(line());
    await ok(moveClip, { clipId: clips[0]!.id, start: 5 * S });
    expect(line()).toEqual(before);
    await ok(setTrackMix, { trackId: "a1", volumeDb: 0 });
    expect(line()).toEqual(before);
  });
});

describe("writePass", () => {
  /** The line's level at each time, to compare before and after a write. */
  const levels = (times: number[]) => times.map((t) => Number(trackValue(line()!, t)));

  it("replaces only the keys of its span, the line outside it playing as before", async () => {
    for (const [at, db] of [
      [S, -6],
      [3 * S, -9],
      [4 * S, -12],
      [8 * S, -20],
    ] as const) {
      await ok(setLineKey, { trackId: "a1", at, db });
    }
    const outside = [0, S, 1.5 * S, 2 * S - 1, 5 * S + 1, 6 * S, 7 * S, 9 * S];
    const before = levels(outside);
    await ok(writePass, {
      trackId: "a1",
      from: 2 * S,
      to: 5 * S,
      points: [
        { at: 2 * S, db: 0 },
        { at: 5 * S, db: -2 },
      ],
    });
    expect(levels([2 * S, 5 * S])).toEqual([0, -2]);
    levels(outside).forEach((db, i) => expect(db).toBeCloseTo(before[i]!, 6));
    expect(keys().map(([t]) => t)).toEqual([S, 2 * S - 1, 2 * S, 5 * S, 5 * S + 1, 8 * S]);
    kernel.history.undo();
    expect(keys()).toHaveLength(4);
    expect(keys()[1]).toEqual([3 * S, -9]);
  });

  it("writes a looped Latch pass once, each lap on the line it began with", async () => {
    await ok(setLineKey, { trackId: "a1", at: 0, db: -6 });
    // Two laps of a 0-4 s loop with the fader 4 dB under the track's volume.
    const lap = () => [0, S, 2 * S, 3 * S, 4 * S].map((at) => ({ at, db: -10 }));
    await ok(writePasses, { trackId: "a1", spans: passSpans([lap(), lap()]) });
    expect(levels([0, 2 * S, 4 * S])).toEqual([-10, -10, -10]);
    expect(levels([4 * S + 1, 6 * S])).toEqual([-6, -6]);
    kernel.history.undo();
    expect(keys()).toEqual([[0, -6]]);
  });

  it("leaves the stretches a pass skipped over as they were, in one step", async () => {
    await ok(setLineKey, { trackId: "a1", at: 4 * S, db: -8 });
    await ok(setLineKey, { trackId: "a1", at: 6 * S, db: -20, ease: { kind: "hold" } });
    const skipped = line()!.keys.find((key) => key.t === 6 * S);
    // A lap from 0 to 2 s, a seek ahead, a lap from 8 to 10 s.
    const outside = [2 * S + 1, 3 * S, 4 * S, 5 * S, 6 * S, 7 * S, 8 * S - 1, 10 * S + 1, 12 * S];
    const before = levels(outside);
    const laps = [
      [0, S, 2 * S].map((at) => ({ at, db: -3 })),
      [8 * S, 9 * S, 10 * S].map((at) => ({ at, db: -3 })),
    ];
    await ok(writePasses, { trackId: "a1", spans: passSpans(laps) });
    expect(line()!.keys.find((key) => key.t === 6 * S)).toEqual(skipped);
    levels(outside).forEach((db, i) => expect(db).toBeCloseTo(before[i]!, 6));
    expect(levels([0, S, 2 * S, 8 * S, 10 * S])).toEqual([-3, -3, -3, -3, -3]);
    kernel.history.undo();
    expect(keys()).toEqual([
      [4 * S, -8],
      [6 * S, -20],
    ]);
  });

  it("sends two Touch holds of one play as one step, the line between them as it was", async () => {
    await ok(setLineKey, { trackId: "a1", at: 0, db: -6 });
    // Held 1-2 s at -2 dB, let go (back on the line), held again 5-6 s at -12 dB.
    const hold = (from: number, db: number) => [
      { at: from, db: -6 },
      { at: from + S / 2, db },
      { at: from + S, db },
      ...returnToLine(line(), from + S + 1),
    ];
    await ok(writePasses, { trackId: "a1", spans: passSpans([hold(S, -2), hold(5 * S, -12)]) });
    expect(levels([S + S / 2, 2 * S, 5 * S + S / 2, 6 * S])).toEqual([-2, -2, -12, -12]);
    expect(levels([0, 3 * S, 4 * S, 7 * S])).toEqual([-6, -6, -6, -6]);
    kernel.history.undo();
    expect(keys()).toEqual([[0, -6]]);
  });

  it("leaves the line after a Touch release unchanged", async () => {
    await ok(setLineKey, { trackId: "a1", at: 6 * S, db: -10 });
    await ok(writePass, {
      trackId: "a1",
      from: S,
      to: 3 * S,
      points: [
        { at: S, db: -4 },
        { at: 3 * S, db: -4 },
      ],
    });
    expect(levels([S, 3 * S])).toEqual([-4, -4]);
    expect(levels([0, S - 1, 3 * S + 1, 4 * S, 6 * S, 7 * S])).toEqual([
      -10, -10, -10, -10, -10, -10,
    ]);
  });

  it("refuses points outside the span or out of range, changing nothing", async () => {
    await ok(setLineKey, { trackId: "a1", at: S, db: -6 });
    const outside = await run(writePass, {
      trackId: "a1",
      from: 2 * S,
      to: 3 * S,
      points: [{ at: 4 * S, db: 0 }],
    });
    expect(outside).toMatchObject({ ok: false, error: { code: "sound.line_range" } });
    const loud = await run(writePass, {
      trackId: "a1",
      from: 2 * S,
      to: 3 * S,
      points: [{ at: 2 * S, db: 40 }],
    });
    expect(loud).toMatchObject({ ok: false });
    expect(keys()).toEqual([[S, -6]]);
  });
});
