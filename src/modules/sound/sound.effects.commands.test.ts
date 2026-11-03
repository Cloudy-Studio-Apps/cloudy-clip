import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineCommand, type Kernel } from "@/core";
import { z } from "zod";
import { createProjectModule, projectRef, seedProject, type SoundEffect } from "@/modules/project";
import { soundModule } from "./sound.module";
import {
  addEffect,
  applyPreset,
  moveEffect,
  removeEffect,
  setEffect,
} from "./sound.effects.commands";

let kernel: Kernel;
const state = () => kernel.modules.require(projectRef).store.getState();
const run = (command: Parameters<Kernel["bus"]["run"]>[0], input: unknown) =>
  kernel.bus.run(command, input as never);
const chain = (id: string): SoundEffect[] => state().tracks[id]?.mix?.effects ?? [];

async function add(target: string, kind: string): Promise<string> {
  const result = await run(addEffect, { target, kind });
  if (!result.ok) throw new Error(result.error.code);
  return (result.value as { effectId: string }).effectId;
}

// The timeline module owns removing a track; the settle hook is what is under test here.
const dropTrack = defineCommand({
  id: "test.dropTrack",
  label: "Drop track",
  description: "test",
  undoable: true,
  input: z.object({ trackId: z.string() }),
  run(ctx, { trackId }) {
    ctx.mutate(ctx.require(projectRef).store, (draft) => {
      delete draft.tracks[trackId];
      const c = draft.compositions.c1!;
      c.trackOrder = c.trackOrder.filter((id) => id !== trackId);
    });
  },
});

beforeEach(async () => {
  kernel = await createKernel();
  const audio = (id: string) => ({
    id,
    kind: "audio" as const,
    name: id,
    clipIds: [],
    muted: false,
    hidden: false,
  });
  await kernel.modules.loadAll([
    createProjectModule(seedProject({ tracks: { a1: audio("a1"), a2: audio("a2") } })),
    soundModule,
  ]);
});

describe("effect chains", () => {
  it("allows one effect of each kind per chain", async () => {
    await add("a1", "compressor");
    const second = await run(addEffect, { target: "a1", kind: "compressor" });
    expect(second).toMatchObject({ ok: false, error: { code: "sound.effect_exists" } });
    expect(chain("a1")).toHaveLength(1);
  });

  it("refuses a loop of ducks, itself included", async () => {
    const duckA = await add("a1", "duck");
    const duckB = await add("a2", "duck");
    const self = await run(setEffect, {
      target: "a1",
      effectId: duckA,
      patch: { listensTo: ["a1"] },
    });
    expect(self).toMatchObject({ ok: false, error: { code: "sound.duck_loop" } });
    const first = await run(setEffect, {
      target: "a1",
      effectId: duckA,
      patch: { listensTo: ["a2"] },
    });
    expect(first.ok).toBe(true);
    const back = await run(setEffect, {
      target: "a2",
      effectId: duckB,
      patch: { listensTo: ["a1"] },
    });
    expect(back).toMatchObject({ ok: false, error: { code: "sound.duck_loop" } });
  });

  it("replaces the chain with a preset in one undo step", async () => {
    await add("a1", "gate");
    const gate = chain("a1")[0]!;
    await run(applyPreset, { target: "a1", presetId: "clear-voice" });
    expect(chain("a1").map((e) => e.kind)).toEqual(["eq", "gate", "compressor", "deesser"]);
    expect(chain("a1").some((e) => e.id === gate.id)).toBe(false);
    kernel.history.undo();
    expect(chain("a1")).toEqual([gate]);
  });

  it("drops a deleted track from every listensTo", async () => {
    const duck = await add("a1", "duck");
    await run(setEffect, { target: "a1", effectId: duck, patch: { listensTo: ["a2"] } });
    await run(dropTrack, { trackId: "a2" });
    expect(chain("a1")[0]).toMatchObject({ kind: "duck", listensTo: [] });
  });

  it("stores no mix when the chain empties, and refuses values out of range", async () => {
    const id = await add("a1", "compressor");
    const bad = await run(setEffect, {
      target: "a1",
      effectId: id,
      patch: { params: { ratio: 0.5 } },
    });
    expect(bad).toMatchObject({ ok: false, error: { code: "sound.effect_invalid" } });
    await run(moveEffect, { target: "a1", effectId: id, to: 5 });
    await run(removeEffect, { target: "a1", effectId: id });
    expect(state().tracks.a1!.mix).toBeUndefined();
  });
});
