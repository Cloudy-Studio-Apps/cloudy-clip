import { Scissors } from "lucide-react";
import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { elementModule, prop } from "@/modules/element";
import {
  createEmptyProject,
  createProjectModule,
  projectRef,
  type Clip,
  type ProjectState,
} from "@/modules/project";
import { addJunction, removeJunction, setJunction } from "./junction.commands";
import { junctionMcpTools } from "./junction.mcp";
import { junctionModule } from "./junction.module";
import { junctionKinds } from "./junction.points";
import { defineJunctionKind } from "./logic/define";

const S = 1_000_000;

const overlapping = defineJunctionKind({
  kind: "test.dissolve",
  name: "Dissolve",
  icon: Scissors,
  tracks: ["video"],
  properties: { amount: prop.number({ min: 0, max: 1 }) },
  defaults: () => ({ amount: 0.5 }),
  overlap: {
    default: 500_000,
    min: () => 100_000,
    max: (l, r) => Math.floor(Math.min(l.duration, r.duration) / 2),
  },
});
const cutKind = defineJunctionKind({
  kind: "test.cut",
  name: "Hard",
  icon: Scissors,
  tracks: ["video"],
  properties: {},
  defaults: () => ({}),
  overlap: false,
});

const kindsModule = defineModule({
  ref: defineModuleRef<Record<string, never>>("junction-kinds-test"),
  name: "kinds",
  tier: "feature",
  requires: ["junction"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(junctionKinds, overlapping);
    contribute(junctionKinds, cutKind);
    return { api: {} };
  },
});

let kernel: Kernel;
let trackV: string;
let trackA: string;
const doc = () => kernel.modules.require(projectRef).store.getState();

const clip = (
  id: string,
  trackId: string,
  start: number,
  duration: number,
  linkId?: string,
): Clip => ({
  id,
  trackId,
  kind: "media",
  props: {},
  start,
  sourceIn: 0,
  duration,
  ...(linkId && { linkId }),
});

/** V1: A [0,4) B [4,8) C [8,10); sounds sA sB sC linked on A1. */
function project(): ProjectState {
  const s = createEmptyProject();
  trackV = s.trackOrder[0]!;
  trackA = s.trackOrder[1]!;
  const rows: [string, number, number][] = [
    ["A", 0, 4],
    ["B", 4, 4],
    ["C", 8, 2],
  ];
  for (const [id, start, dur] of rows) {
    s.clips[id] = clip(id, trackV, start * S, dur * S, `l${id}`);
    s.clips[`s${id}`] = clip(`s${id}`, trackA, start * S, dur * S, `l${id}`);
    s.tracks[trackV]!.clipIds.push(id);
    s.tracks[trackA]!.clipIds.push(`s${id}`);
  }
  return s;
}

const starts = () => Object.fromEntries(Object.values(doc().clips).map((c) => [c.id, c.start / S]));

async function load(change?: (state: ProjectState) => void) {
  kernel = await createKernel();
  const initial = project();
  change?.(initial);
  await kernel.modules.loadAll([
    createProjectModule(initial),
    elementModule,
    junctionModule,
    kindsModule,
  ]);
}

beforeEach(() => load());

const add = (extra: Record<string, unknown> = {}) =>
  kernel.bus.run(addJunction, {
    kind: "test.dissolve",
    leftClipId: "A",
    rightClipId: "B",
    ...extra,
  } as never);

async function added(extra: Record<string, unknown> = {}) {
  const result = await add(extra);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe("junction commands", () => {
  it("add overlapping kind shifts B, C and their sounds 0.5 s earlier", async () => {
    const j = await added();
    expect(j.duration).toBe(500_000);
    expect(starts()).toEqual({ A: 0, B: 3.5, C: 7.5, sA: 0, sB: 3.5, sC: 7.5 });
    expect(doc().junctions[j.id]).toEqual(j);
  });

  it("add non-overlapping kind moves nothing", async () => {
    const before = starts();
    const j = await added({ kind: "test.cut", duration: S });
    expect(j.duration).toBe(0);
    expect(starts()).toEqual(before);
  });

  it("add then undo restores layout", async () => {
    const before = structuredClone(doc());
    await added();
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });

  it("add by track and time finds the cut", async () => {
    const j = await added({
      leftClipId: undefined,
      rightClipId: undefined,
      trackId: trackV,
      at: 4 * S,
    });
    expect([j.leftClipId, j.rightClipId]).toEqual(["A", "B"]);
  });

  it("add fails with junction.overlap when an unlinked audio clip blocks a shifting partner, and changes nothing", async () => {
    // An unlinked audio clip sits where sB would land, after a shortened sA.
    await load((state) => {
      state.clips.sA!.duration = 3 * S;
      state.clips.X = clip("X", trackA, 3.2 * S, 0.7 * S);
      state.tracks[trackA]!.clipIds.splice(1, 0, "X");
    });
    const before = structuredClone(doc());
    const result = await add();
    expect(!result.ok && result.error.code).toBe("junction.overlap");
    expect(!result.ok && result.error.message).toContain('"X"');
    expect(doc()).toEqual(before);
  });

  it("add refuses a duration above half the shorter clip with junction.invalid_duration", async () => {
    const result = await add({ duration: 3 * S });
    expect(!result.ok && result.error.code).toBe("junction.invalid_duration");
    expect(!result.ok && result.error.message).toContain("between 0.100 s and 2.000 s");
  });

  it("add refuses a cut with a gap (junction.no_cut) and a second junction on a cut (junction.exists)", async () => {
    const gap = await add({ leftClipId: "A", rightClipId: "C" });
    expect(!gap.ok && gap.error.code).toBe("junction.no_cut");
    await added({ kind: "test.cut" });
    const again = await add({ kind: "test.cut" });
    expect(!again.ok && again.error.code).toBe("junction.exists");
  });

  it("add refuses an unknown kind and a wrong track kind", async () => {
    const unknown = await add({ kind: "nope" });
    expect(!unknown.ok && unknown.error.code).toBe("junction.unknown_kind");
    const audio = await add({ leftClipId: "sA", rightClipId: "sB" });
    expect(!audio.ok && audio.error.code).toBe("junction.track_kind");
  });

  it("set duration 0.5 → 1 s shifts by another 0.5 s; remove shifts back", async () => {
    const j = await added();
    const set = await kernel.bus.run(setJunction, { junctionIds: [j.id], duration: S });
    expect(set.ok).toBe(true);
    expect(starts()).toEqual({ A: 0, B: 3, C: 7, sA: 0, sB: 3, sC: 7 });
    const removed = await kernel.bus.run(removeJunction, { junctionIds: [j.id] });
    expect(removed.ok && removed.value.removed).toBe(1);
    expect(starts()).toEqual({ A: 0, B: 4, C: 8, sA: 0, sB: 4, sC: 8 });
    expect(doc().junctions).toEqual({});
  });

  it("set patch validates against the kind schema", async () => {
    const j = await added();
    const bad = await kernel.bus.run(setJunction, { junctionIds: [j.id], patch: { amount: 5 } });
    expect(!bad.ok && bad.error.code).toBe("junction.invalid_props");
    const good = await kernel.bus.run(setJunction, { junctionIds: [j.id], patch: { amount: 0.8 } });
    expect(good.ok).toBe(true);
    expect(doc().junctions[j.id]!.props).toEqual({ amount: 0.8 });
    await kernel.bus.run(setJunction, { junctionIds: [j.id], patch: { amount: 0.5 } });
    expect(doc().junctions[j.id]!.props).toEqual({});
  });

  it("set and remove fail on a missing junction", async () => {
    const result = await kernel.bus.run(removeJunction, { junctionIds: ["zzz"] });
    expect(!result.ok && result.error.code).toBe("junction.not_found");
  });

  it("junction_describe lists kinds with their schema", async () => {
    const tool = junctionMcpTools.find((t) => t.name === "junction_describe")!;
    const result = await tool.handler(
      {},
      {
        bus: kernel.bus,
        history: kernel.history,
        caller: { key: "agent", name: "Agent" },
        require: (ref) => kernel.modules.require(ref),
      },
    );
    const text = JSON.stringify(result);
    expect(text).toContain("test.dissolve");
    expect(text).toContain("amount");
  });
});
