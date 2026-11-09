import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { compositionMixOf, createProjectModule, projectRef, seedProject } from "@/modules/project";
import { soundModule } from "./sound.module";
import { addBus, removeBus, sendTo, setBus } from "./sound.bus.commands";
import { addEffect, setEffect } from "./sound.effects.commands";
import { setTrackMix, switchMix } from "./sound.mix.commands";

let kernel: Kernel;
const state = () => kernel.modules.require(projectRef).store.getState();
const run = (command: Parameters<Kernel["bus"]["run"]>[0], input: unknown) =>
  kernel.bus.run(command, input as never);
const buses = () => compositionMixOf(state().compositions.c1!).buses ?? [];

async function ok<T = unknown>(command: Parameters<Kernel["bus"]["run"]>[0], input: unknown) {
  const result = await run(command, input);
  if (!result.ok) throw new Error(result.error.code);
  return result.value as T;
}

beforeEach(async () => {
  kernel = await createKernel();
  await kernel.modules.loadAll([createProjectModule(seedProject()), soundModule]);
});

describe("groups", () => {
  it("adds, edits and refuses a missing group", async () => {
    const { busId } = await ok<{ busId: string }>(addBus, { name: "Dialogue" });
    expect(buses()).toEqual([{ id: busId, name: "Dialogue", volumeDb: 0, muted: false }]);
    await ok(setBus, { busId, patch: { volumeDb: -6, muted: true } });
    expect(buses()[0]).toMatchObject({ volumeDb: -6, muted: true });
    const missing = await run(setBus, { busId: "nope", patch: { muted: true } });
    expect(missing).toMatchObject({ ok: false, error: { code: "sound.bus_not_found" } });
    const unsent = await run(sendTo, { trackIds: ["a1"], busId: "nope" });
    expect(unsent).toMatchObject({ ok: false, error: { code: "sound.bus_not_found" } });
  });

  it("removing a group sends its tracks to Master, and one undo restores both", async () => {
    const { busId } = await ok<{ busId: string }>(addBus, { name: "Dialogue" });
    await ok(sendTo, { trackIds: ["a1"], busId });
    expect(state().tracks.a1!.mix?.busId).toBe(busId);
    await ok(removeBus, { busId });
    expect(buses()).toEqual([]);
    expect(state().tracks.a1!.mix).toBeUndefined();
    kernel.history.undo();
    expect(buses()).toHaveLength(1);
    expect(state().tracks.a1!.mix?.busId).toBe(busId);
  });

  it("removing a group drops the ducks that listen to it", async () => {
    const { busId } = await ok<{ busId: string }>(addBus, { name: "Music" });
    const { effectId } = await ok<{ effectId: string }>(addEffect, { target: "a1", kind: "duck" });
    await ok(setEffect, { target: "a1", effectId, patch: { listensTo: [busId] } });
    expect(state().tracks.a1!.mix?.effects?.[0]).toMatchObject({ listensTo: [busId] });
    await ok(removeBus, { busId });
    expect(state().tracks.a1!.mix?.effects?.[0]).toMatchObject({ listensTo: [] });
  });

  it("a group takes effects and refuses a duck loop", async () => {
    const { busId } = await ok<{ busId: string }>(addBus, { name: "Dialogue" });
    await ok(sendTo, { trackIds: ["a1"], busId });
    await ok(addEffect, { target: busId, kind: "limiter" });
    expect(buses()[0]!.effects).toHaveLength(1);
    const duck = await ok<{ effectId: string }>(addEffect, { target: "a1", kind: "duck" });
    const loop = await run(setEffect, {
      target: "a1",
      effectId: duck.effectId,
      patch: { listensTo: [busId] },
    });
    expect(loop).toMatchObject({ ok: false, error: { code: "sound.duck_loop" } });
  });
});

describe("mix A and B with groups", () => {
  it("swaps group values and keeps the ids valid", async () => {
    const { busId } = await ok<{ busId: string }>(addBus, { name: "Dialogue" });
    await ok(sendTo, { trackIds: ["a1"], busId });
    await ok(setBus, { busId, patch: { volumeDb: -6 } });
    await ok(switchMix, { to: "b" });
    expect(buses()[0]).toMatchObject({ id: busId, volumeDb: -6 });
    await ok(setBus, { busId, patch: { volumeDb: -12 } });
    await ok(setTrackMix, { trackId: "a1", volumeDb: -3 });
    await ok(switchMix, { to: "a" });
    expect(buses()[0]).toMatchObject({ id: busId, volumeDb: -6 });
    expect(state().tracks.a1!.mix?.busId).toBe(busId);
    await ok(switchMix, { to: "b" });
    expect(buses()[0]).toMatchObject({ id: busId, volumeDb: -12 });
    expect(state().tracks.a1!.mix?.busId).toBe(busId);
  });

  it("removing a group removes it from the other mix too", async () => {
    const { busId } = await ok<{ busId: string }>(addBus, { name: "Dialogue" });
    await ok(sendTo, { trackIds: ["a1"], busId });
    await ok(switchMix, { to: "b" });
    await ok(removeBus, { busId });
    await ok(switchMix, { to: "a" });
    expect(buses()).toEqual([]);
    expect(state().tracks.a1!.mix?.busId).toBeUndefined();
  });
});
