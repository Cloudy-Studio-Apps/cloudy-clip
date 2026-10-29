import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { elementModule, prop } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { inspectorModule } from "@/modules/inspector";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import {
  createEmptyProject,
  createProjectModule,
  projectRef,
  type Clip,
  type ProjectState,
} from "@/modules/project";
import { timelineModule } from "@/modules/timeline";
import { applyTransition } from "./transition.commands";
import { transitionMcpTools } from "./transition.mcp";
import { transitionModule } from "./transition.module";
import { defineTransitionPreset, transitionPresets } from "./transition.points";

const S = 1_000_000;

const fade = defineTransitionPreset({
  id: "test.fade",
  name: "Test fade",
  category: "basic",
  properties: { amount: prop.number({ min: 0, max: 1 }) },
  defaults: () => ({ amount: 0.5 }),
  mix: () => {},
});
const wipe = defineTransitionPreset({
  id: "test.wipe",
  name: "Test wipe",
  category: "basic",
  properties: { angle: prop.number({ min: 0, max: 360 }) },
  defaults: () => ({ angle: 0 }),
  mix: () => {},
});

const presetsModule = defineModule({
  ref: defineModuleRef<Record<string, never>>("transition-presets-test"),
  name: "presets",
  tier: "feature",
  requires: ["transition"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(transitionPresets, fade, wipe);
    return { api: {} };
  },
});

let kernel: Kernel;
let trackV: string;
let trackA: string;
const doc = () => kernel.modules.require(projectRef).store.getState();

const clip = (id: string, trackId: string, start: number, duration: number): Clip => ({
  id,
  trackId,
  kind: "media",
  props: {},
  start,
  sourceIn: 0,
  duration,
});

/** V1: A [0,4) B [4,8) C [8,10); A1: sA [0,4) sB [4,8). */
function project(): ProjectState {
  const s = createEmptyProject();
  trackV = s.trackOrder[0]!;
  trackA = s.trackOrder[1]!;
  for (const [id, start, dur] of [
    ["A", 0, 4],
    ["B", 4, 4],
    ["C", 8, 2],
  ] as const) {
    s.clips[id] = clip(id, trackV, start * S, dur * S);
    s.tracks[trackV]!.clipIds.push(id);
  }
  for (const [id, start] of [
    ["sA", 0],
    ["sB", 4],
  ] as const) {
    s.clips[id] = clip(id, trackA, start * S, 4 * S);
    s.tracks[trackA]!.clipIds.push(id);
  }
  return s;
}

const starts = () => Object.fromEntries(Object.values(doc().clips).map((c) => [c.id, c.start / S]));
const apply = (input: Record<string, unknown>) =>
  kernel.bus.run(applyTransition, { preset: "test.fade", ...input } as never);

beforeEach(async () => {
  kernel = await createKernel();
  await kernel.modules.loadAll([
    createProjectModule(project()),
    elementModule,
    junctionModule,
    createFakeMediaModule({}),
    createFakeFontsModule(),
    previewModule,
    inspectorModule,
    timelineModule,
    transitionModule,
    presetsModule,
  ]);
});

describe("transition.apply", () => {
  it("apply on a cut adds a 0.5 s transition and shifts the right clip", async () => {
    const result = await apply({ leftClipId: "A", rightClipId: "B" });
    expect(result.ok).toBe(true);
    const junction = Object.values(doc().junctions)[0]!;
    expect(junction).toMatchObject({ kind: "transition", duration: 500_000 });
    expect(junction.props).toEqual({ preset: "test.fade" });
    expect(starts()).toMatchObject({ A: 0, B: 3.5, C: 7.5 });
  });

  it("apply on a cut that has one replaces the preset, drops old options, keeps the duration", async () => {
    await apply({ leftClipId: "A", rightClipId: "B", options: { amount: 0.9 }, duration: S });
    const first = Object.values(doc().junctions)[0]!;
    expect(first.props).toEqual({ preset: "test.fade", options: { amount: 0.9 } });
    const result = await apply({ preset: "test.wipe", leftClipId: "A", rightClipId: "B" });
    expect(result.ok && result.value.id).toBe(first.id);
    const junctions = Object.values(doc().junctions);
    expect(junctions).toHaveLength(1);
    expect(junctions[0]).toMatchObject({ duration: S, props: { preset: "test.wipe" } });
    expect(junctions[0]!.props.options).toBeUndefined();
    expect(starts()).toMatchObject({ B: 3, C: 7 });
  });

  it("changing the preset with new options keeps only the new ones, in one undo step", async () => {
    await apply({ leftClipId: "A", rightClipId: "B", options: { amount: 0.9 } });
    const before = structuredClone(doc());
    await apply({ preset: "test.wipe", clipId: "A", options: { angle: 90 } });
    expect(Object.values(doc().junctions)[0]!.props).toEqual({
      preset: "test.wipe",
      options: { angle: 90 },
    });
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });

  it("apply with an unknown preset fails with transition.unknown_preset", async () => {
    const before = structuredClone(doc());
    const result = await apply({ preset: "nope", leftClipId: "A", rightClipId: "B" });
    expect(!result.ok && result.error.code).toBe("transition.unknown_preset");
    expect(doc()).toEqual(before);
  });

  it("apply rejects options the preset doesn't accept", async () => {
    const result = await apply({ leftClipId: "A", rightClipId: "B", options: { amount: 5 } });
    expect(!result.ok && result.error.code).toBe("transition.invalid_options");
  });

  it("apply with clipId uses the cut at the end of that clip", async () => {
    await apply({ clipId: "B" });
    expect(Object.values(doc().junctions)[0]).toMatchObject({
      leftClipId: "B",
      rightClipId: "C",
    });
  });

  it("apply by track and time finds the cut", async () => {
    await apply({ trackId: trackV, at: 4 * S });
    expect(Object.values(doc().junctions)[0]).toMatchObject({
      leftClipId: "A",
      rightClipId: "B",
    });
  });

  it("apply on an audio track fails with junction.track_kind", async () => {
    const result = await apply({ leftClipId: "sA", rightClipId: "sB" });
    expect(!result.ok && result.error.code).toBe("junction.track_kind");
  });

  it("transition_list_presets lists the test preset with its options schema", async () => {
    const tool = transitionMcpTools.find((t) => t.name === "transition_list_presets")!;
    const result = await tool.handler(
      {},
      { bus: kernel.bus, history: kernel.history, require: (ref) => kernel.modules.require(ref) },
    );
    const text = (result.content[0] as { text: string }).text;
    const listed = JSON.parse(text) as {
      id: string;
      category: string;
      options: { properties: Record<string, unknown> };
      defaults: unknown;
    }[];
    const entry = listed.find((p) => p.id === "test.fade")!;
    expect(entry.category).toBe("basic");
    expect(Object.keys(entry.options.properties)).toEqual(["amount"]);
    expect(entry.defaults).toEqual({ amount: 0.5 });
    expect(listed.map((p) => p.id)).toEqual(expect.arrayContaining(["test.fade", "test.wipe"]));
  });
});
