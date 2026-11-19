import { Film } from "lucide-react";
import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { defineElement, elementModule, elements, prop } from "@/modules/element";
import {
  createProjectModule,
  IDENTITY_TRANSFORM,
  projectRef,
  seedProject,
  type Clip,
} from "@/modules/project";
import { addMask, removeMasks, reorderMask, updateMask } from "./mask.commands";
import { setMatte } from "./mask.matte.commands";
import { maskModule } from "./mask.module";

const S = 1_000_000;

const picture = defineElement({
  kind: "test.picture",
  name: "Picture",
  source: "none",
  tracks: ["video"],
  picture: { fit: "contain", source: "media" },
  properties: { content: prop.string() },
  defaults: () => ({ content: "" }),
  display: () => ({ icon: Film, color: "clip-video", label: "Picture", body: "none" }),
});

const fixtures = defineModule({
  ref: defineModuleRef<Record<string, never>>("mask-test-fixtures"),
  name: "fixtures",
  tier: "feature",
  requires: ["element"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(elements, picture);
    return { api: {} };
  },
});

const stub = (id: string) =>
  defineModule({
    ref: defineModuleRef<Record<string, never>>(id),
    name: id,
    tier: "feature",
    commands: [],
    mcpTools: [],
    setup: () => ({ api: {} }),
  });

const pictureClip = (id: string, trackId: string): Clip => ({
  id,
  trackId,
  kind: "test.picture",
  start: 0,
  sourceIn: 0,
  duration: 2 * S,
  props: {},
  transform: { ...IDENTITY_TRANSFORM },
});

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();

type Result = Promise<{ ok: true; value: unknown } | { ok: false; error: { code: string } }>;
async function ok<T>(promise: Result) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value as T;
}
async function code(promise: Result) {
  const result = await promise;
  if (result.ok) throw new Error("expected a failure");
  return result.error.code;
}

const ellipse = async (clipId: string) =>
  (
    await ok<{ maskIds: Record<string, string> }>(
      kernel.bus.run(addMask, { clipIds: [clipId], preset: "ellipse" }),
    )
  ).maskIds[clipId]!;

beforeEach(async () => {
  kernel = await createKernel();
  const state = seedProject();
  state.tracks.v2 = { ...state.tracks.v1!, id: "v2", name: "Video 2", clipIds: ["b"] };
  state.tracks.v1!.clipIds.push("a");
  state.tracks.a1!.clipIds.push("s");
  state.compositions.c1!.trackOrder = ["v1", "v2", "a1"];
  state.clips.a = pictureClip("a", "v1");
  state.clips.b = pictureClip("b", "v2");
  state.tracks.v1!.clipIds.push("k");
  state.clips.k = {
    ...pictureClip("k", "v1"),
    masks: {
      m1: {
        id: "m1",
        name: "Mask 1",
        color: "orange",
        mode: "add",
        opacity: 1,
        feather: 0,
        expansion: 0,
        x: 0,
        y: 0,
        rotation: 0,
        shape: { kind: "ellipse", width: 100, height: 100 },
      },
    },
    maskOrder: ["m1"],
    animation: {
      "masks.m1.feather": {
        shared: true,
        blend: "number",
        keys: [{ id: "k1", t: 0, value: 0, ease: { kind: "linear" } }],
      },
    },
  };
  state.clips.s = { ...pictureClip("s", "a1"), kind: "test.picture" };
  await kernel.modules.loadAll([
    createProjectModule(state),
    elementModule,
    stub("preview"),
    fixtures,
    maskModule,
  ]);
});

describe("masks", () => {
  it("adds an ellipse to two clips in one undo step", async () => {
    const before = doc();
    await ok(kernel.bus.run(addMask, { clipIds: ["a", "b"], preset: "ellipse" }));
    expect(doc().clips.a!.maskOrder).toHaveLength(1);
    expect(doc().clips.b!.maskOrder).toHaveLength(1);
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });

  it("refuses a mask on an audio clip", async () => {
    const before = doc();
    expect(await code(kernel.bus.run(addMask, { clipIds: ["a", "s"], preset: "ellipse" }))).toBe(
      "mask.not_picture",
    );
    expect(doc()).toBe(before);
  });

  it("updating a keyed feather without at fails and with at writes a key", async () => {
    const patch = { feather: 40, opacity: 0.5 };
    const input = { clipId: "k", maskId: "m1", patch };
    expect(await code(kernel.bus.run(updateMask, input))).toBe("mask.animated");
    await ok(kernel.bus.run(updateMask, { ...input, at: S }));
    const clip = doc().clips.k!;
    expect(clip.animation!["masks.m1.feather"]!.keys).toHaveLength(2);
    expect(clip.masks!.m1!.opacity).toBe(0.5);
  });

  it("removing the last mask leaves no masks and no mask keys", async () => {
    await ok(kernel.bus.run(removeMasks, { clipId: "k", maskIds: [] }));
    const clip = doc().clips.k!;
    expect(clip.masks).toBeUndefined();
    expect(clip.maskOrder).toBeUndefined();
    expect(clip.animation).toBeUndefined();
  });

  it("reorders masks", async () => {
    const first = await ellipse("a");
    const second = await ellipse("a");
    await ok(kernel.bus.run(reorderMask, { clipId: "a", maskId: second, index: 0 }));
    expect(doc().clips.a!.maskOrder).toEqual([second, first]);
  });

  it("sets a matte, refuses its own track and a chain", async () => {
    expect(await code(kernel.bus.run(setMatte, { clipIds: ["a"], trackId: "v1" }))).toBe(
      "mask.own_track",
    );
    await ok(kernel.bus.run(setMatte, { clipIds: ["b"], trackId: "v1" }));
    expect(doc().clips.b!.matte).toEqual({ trackId: "v1", by: "alpha" });
    expect(await code(kernel.bus.run(setMatte, { clipIds: ["a"], trackId: "v2" }))).toBe(
      "mask.matte_chain",
    );
    await ok(kernel.bus.run(setMatte, { clipIds: ["b"], trackId: null }));
    expect(doc().clips.b!.matte).toBeUndefined();
  });
});
