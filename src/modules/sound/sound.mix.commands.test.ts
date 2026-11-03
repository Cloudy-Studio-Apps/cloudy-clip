import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { createProjectModule, projectRef, seedProject, compositionMixOf } from "@/modules/project";
import { soundModule } from "./sound.module";
import { resetTrackMix, setMaster, setTrackMix, switchMix } from "./sound.mix.commands";

let kernel: Kernel;
const state = () => kernel.modules.require(projectRef).store.getState();
const run = <I>(command: Parameters<Kernel["bus"]["run"]>[0], input: I) =>
  kernel.bus.run(command, input as never);
const mix = () => state().tracks.a1!.mix;

async function ok(command: Parameters<Kernel["bus"]["run"]>[0], input: unknown) {
  const result = await run(command, input);
  if (!result.ok) throw new Error(result.error.code);
}

beforeEach(async () => {
  kernel = await createKernel();
  await kernel.modules.loadAll([createProjectModule(seedProject()), soundModule]);
});

describe("track and master mix", () => {
  it("stores nothing at the defaults", async () => {
    await ok(setTrackMix, { trackId: "a1", volumeDb: -6 });
    expect(mix()).toEqual({ volumeDb: -6, pan: 0 });
    await ok(setTrackMix, { trackId: "a1", volumeDb: 0 });
    expect(mix()).toBeUndefined();
    await ok(setMaster, { volumeDb: -3 });
    await ok(setMaster, { volumeDb: 0 });
    expect(state().compositions.c1!.mix).toBeUndefined();
  });

  it("refuses a video track and a missing one", async () => {
    const video = await run(setTrackMix, { trackId: "v1", pan: 0.5 });
    expect(video).toMatchObject({ ok: false, error: { code: "sound.not_audio" } });
    const missing = await run(setTrackMix, { trackId: "nope", pan: 0.5 });
    expect(missing).toMatchObject({ ok: false, error: { code: "sound.track_not_found" } });
  });

  it("resets a track and undoes it", async () => {
    await ok(setTrackMix, { trackId: "a1", volumeDb: -6, pan: 0.5 });
    await ok(resetTrackMix, { trackId: "a1" });
    expect(mix()).toBeUndefined();
    kernel.history.undo();
    expect(mix()).toEqual({ volumeDb: -6, pan: 0.5 });
  });
});

describe("mix A and B", () => {
  it("switches to B by copying A, and back to the same values", async () => {
    await ok(setTrackMix, { trackId: "a1", volumeDb: -6 });
    await ok(switchMix, { to: "b" });
    expect(mix()?.volumeDb).toBe(-6);
    await ok(setTrackMix, { trackId: "a1", volumeDb: -12 });
    await ok(switchMix, { to: "a" });
    expect(mix()?.volumeDb).toBe(-6);
    await ok(switchMix, { to: "b" });
    expect(mix()?.volumeDb).toBe(-12);
  });

  it("swaps the master too", async () => {
    await ok(setMaster, { volumeDb: -4 });
    await ok(switchMix, { to: "b" });
    await ok(setMaster, { volumeDb: -9 });
    await ok(switchMix, { to: "a" });
    expect(compositionMixOf(state().compositions.c1!).master.volumeDb).toBe(-4);
    expect(compositionMixOf(state().compositions.c1!).otherMix?.master.volumeDb).toBe(-9);
  });

  it("leaves out tracks that were deleted since", async () => {
    const project = seedProject();
    project.compositions.c1!.mix = {
      master: { volumeDb: 0 },
      activeMix: "a",
      otherMix: {
        master: { volumeDb: 0 },
        tracks: { a1: { volumeDb: -3, pan: 0 }, gone: { volumeDb: -9, pan: 0 } },
      },
    };
    kernel = await createKernel();
    await kernel.modules.loadAll([createProjectModule(project), soundModule]);
    await ok(switchMix, { to: "b" });
    expect(mix()?.volumeDb).toBe(-3);
    expect(state().tracks.gone).toBeUndefined();
    expect(compositionMixOf(state().compositions.c1!).otherMix?.tracks.gone).toBeUndefined();
  });

  it("undoes a switch in one step", async () => {
    await ok(setTrackMix, { trackId: "a1", volumeDb: -6 });
    await ok(switchMix, { to: "b" });
    await ok(setTrackMix, { trackId: "a1", volumeDb: -12 });
    await ok(switchMix, { to: "a" });
    kernel.history.undo();
    expect(compositionMixOf(state().compositions.c1!).activeMix).toBe("b");
    expect(mix()?.volumeDb).toBe(-12);
  });
});
