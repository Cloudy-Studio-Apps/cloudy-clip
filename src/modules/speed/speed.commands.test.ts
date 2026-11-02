import { Scissors } from "lucide-react";
import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { elementModule, prop } from "@/modules/element";
import { inspectorModule } from "@/modules/inspector";
import { createFakeFontsModule } from "@/modules/fonts";
import { addJunction, defineJunctionKind, junctionKinds, junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import {
  createProjectModule,
  projectRef,
  seedProject,
  staleJunctions,
  type Clip,
  type ProjectState,
} from "@/modules/project";
import { splitAt, timelineModule, trimClip } from "@/modules/timeline";
import { freezeFrame, resetSpeed, setSpeed } from "./speed.commands";
import { speedModule } from "./speed.module";

const S = 1_000_000;

const dissolve = defineJunctionKind({
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

const kinds = defineModule({
  ref: defineModuleRef<Record<string, never>>("speed-test-kinds"),
  name: "kinds",
  tier: "feature",
  requires: ["junction"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(junctionKinds, dissolve);
    return { api: {} };
  },
});

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();
const clipOf = (id: string) => doc().clips[id]!;

async function run<T>(
  promise: Promise<{ ok: true; value: T } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value;
}

/** Video 1: A [0,4) B [4,8) C [8,10) with linked sounds sA sB sC, from a 60 s file. */
function project(): ProjectState {
  const s = seedProject();
  s.media.m = { id: "m", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  s.mediaOrder = ["m"];
  const [v, a] = s.compositions.c1!.trackOrder;
  const clip = (id: string, trackId: string, start: number, duration: number): Clip => ({
    id,
    trackId,
    kind: "media",
    mediaId: "m",
    props: {},
    start: start * S,
    sourceIn: 0,
    duration: duration * S,
    linkId: `l${id.replace("s", "")}`,
  });
  for (const [id, start, duration] of [
    ["A", 0, 4],
    ["B", 4, 4],
    ["C", 8, 2],
  ] as const) {
    s.clips[id] = clip(id, v!, start, duration);
    s.clips[`s${id}`] = clip(`s${id}`, a!, start, duration);
    s.tracks[v!]!.clipIds.push(id);
    s.tracks[a!]!.clipIds.push(`s${id}`);
  }
  return s;
}

async function load(change?: (state: ProjectState) => void) {
  kernel = await createKernel();
  const initial = project();
  change?.(initial);
  await kernel.modules.loadAll([
    createProjectModule(initial),
    elementModule,
    junctionModule,
    kinds,
    createFakeMediaModule({ m: { status: "ready", duration: 60 * S, width: 100, height: 100 } }),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    inspectorModule,
    speedModule,
  ]);
}

const join = () =>
  run(
    kernel.bus.run(addJunction, {
      kind: "test.dissolve",
      leftClipId: "A",
      rightClipId: "B",
    } as never),
  );

beforeEach(() => load());

describe("speed.set", () => {
  it("halves the clip at 2x and keeps its start and its part of the file", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2 }));
    expect(clipOf("A")).toMatchObject({ start: 0, sourceIn: 0, duration: 2 * S });
    expect(clipOf("A").speed?.rate).toBe(2);
  });

  it("takes a duration and works out the rate", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], duration: 2 * S }));
    expect(clipOf("A").speed?.rate).toBe(2);
    expect(clipOf("A").duration).toBe(2 * S);
  });

  it("refuses a duration outside the range", async () => {
    const result = await kernel.bus.run(setSpeed, { clipIds: ["A"], duration: 100 * S });
    expect(result).toMatchObject({ ok: false, error: { code: "speed.out_of_range" } });
  });

  it("gives linked clips the same speed", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2 }));
    expect(clipOf("sA")).toMatchObject({ duration: 2 * S, speed: clipOf("A").speed });
  });

  it("changes pitch correction without changing the timing", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], pitchCorrection: false }));
    expect(clipOf("A")).toMatchObject({ duration: 4 * S, speed: { pitchCorrection: false } });
  });

  it("moves what follows, with partners, when ripple is on", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2 }));
    expect([clipOf("B").start, clipOf("sB").start, clipOf("C").start]).toEqual([
      2 * S,
      2 * S,
      6 * S,
    ]);
  });

  it("keeps a junction after the clip when ripple is on", async () => {
    await join();
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 0.5 }));
    expect(clipOf("A").duration).toBe(8 * S);
    expect(clipOf("B").start).toBe(7.5 * S);
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("shrinks a junction that no longer fits", async () => {
    await join();
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 8 }));
    expect(Object.values(doc().junctions)[0]!.duration).toBe(250_000);
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("refuses when something unlinked is in the way", async () => {
    await load((s) => {
      delete s.clips.sB!.linkId;
      delete s.clips.B!.linkId;
      s.clips.sB!.start = 1 * S;
    });
    const before = doc();
    const result = await kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 0.5 });
    expect(result).toMatchObject({ ok: false, error: { code: "timeline.overlap" } });
    expect(doc()).toBe(before);
  });

  it("leaves a gap when faster and ripple is off", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2, ripple: false }));
    expect(clipOf("A").duration).toBe(2 * S);
    expect(clipOf("B").start).toBe(4 * S);
  });

  it("stops a slower clip at the next one when ripple is off", async () => {
    await load((s) => {
      for (const id of ["A", "sA"]) s.clips[id]!.duration = 2 * S;
      for (const id of ["B", "sB"]) s.clips[id]!.start = 3 * S;
    });
    const { clips } = await run(
      kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 0.25, ripple: false }),
    );
    expect(clipOf("A").duration).toBe(3 * S);
    expect(clips[0]!.rate).toBeCloseTo(2 / 3);
  });

  it("refuses a junction on the clip's end when ripple is off", async () => {
    await join();
    const result = await kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2, ripple: false });
    expect(result).toMatchObject({ ok: false, error: { code: "speed.joined" } });
  });

  it("ignores a junction on the clip's start when ripple is off", async () => {
    await join();
    await run(kernel.bus.run(setSpeed, { clipIds: ["B"], rate: 2, ripple: false }));
    expect(clipOf("B").duration).toBe(2 * S);
  });

  it("refuses clips without a file's time", async () => {
    await load((s) => {
      s.clips.T = { ...s.clips.C!, id: "T", kind: "text", mediaId: undefined, start: 20 * S };
      delete s.clips.T.linkId;
      s.tracks[s.clips.C!.trackId]!.clipIds.push("T");
    });
    const result = await kernel.bus.run(setSpeed, { clipIds: ["T"], rate: 2 });
    expect(result).toMatchObject({ ok: false, error: { code: "speed.unsupported" } });
  });

  it("keeps fades within a shorter clip", async () => {
    const sound = { fadeIn: 3 * S, fadeOut: 0 } as Clip["sound"];
    await load((s) => {
      s.clips.sA!.sound = { ...s.clips.sA!.sound, ...sound } as Clip["sound"];
    });
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2 }));
    expect(clipOf("sA").sound?.fadeIn).toBe(2 * S);
  });

  it("stores no speed at 1x with pitch correction on", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2 }));
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 1 }));
    expect(clipOf("A")).not.toHaveProperty("speed");
    expect(clipOf("sA")).not.toHaveProperty("speed");
  });

  it("is undone in one step", async () => {
    const before = doc();
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2 }));
    kernel.history.undo();
    expect(doc().clips).toEqual(before.clips);
  });

  it("stays inside the file through 3x and back to 1x", async () => {
    await load((s) => {
      for (const id of ["C", "sC"]) s.clips[id]!.duration = 3_333_337;
    });
    await run(kernel.bus.run(setSpeed, { clipIds: ["C"], rate: 3 }));
    await run(kernel.bus.run(setSpeed, { clipIds: ["C"], rate: 1 }));
    expect(clipOf("C").duration).toBeLessThanOrEqual(3_333_337);
    expect(clipOf("C").duration).toBeGreaterThan(3_333_337 - 4);
  });
});

describe("speed.freezeFrame", () => {
  const freeze = (at = S) => run(kernel.bus.run(freezeFrame, { clipId: "A", at }));
  const afterSplit = (id: string) =>
    Object.values(doc().clips).find((c) => c.trackId === clipOf(id).trackId && c.start === 4 * S)!;

  it("splits at the time and puts a 3 s hold in, moving what follows", async () => {
    const { hold } = await freeze();
    expect(clipOf("A").duration).toBe(S);
    expect(clipOf(hold)).toMatchObject({ start: S, duration: 3 * S, trackId: clipOf("A").trackId });
    expect(afterSplit("A").sourceIn).toBe(S);
    expect(clipOf("B").start).toBe(7 * S);
  });

  it("leaves linked sound a gap of the same length", async () => {
    await freeze();
    const sounds = Object.values(doc().clips).filter((c) => c.trackId === clipOf("sA").trackId);
    expect(
      sounds
        .map((c) => c.start)
        .sort((a, b) => a - b)
        .slice(0, 2),
    ).toEqual([0, 4 * S]);
  });

  it("holds the frame at that time, at any speed", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2 }));
    const { hold } = await freeze();
    expect(clipOf(hold).sourceIn).toBe(2 * S);
  });

  it("makes a hold that trims to any length and keeps its frame when split", async () => {
    const { hold } = await freeze();
    await run(kernel.bus.run(trimClip, { clipId: hold, edge: "end", time: 3.5 * S }));
    expect(clipOf(hold).duration).toBe(2.5 * S);
    const { created } = await run(kernel.bus.run(splitAt, { at: 2 * S, clipIds: [hold] }));
    expect(clipOf(created[0]!).sourceIn).toBe(clipOf(hold).sourceIn);
  });

  it("refuses to change a hold's speed", async () => {
    const { hold } = await freeze();
    const result = await kernel.bus.run(setSpeed, { clipIds: [hold], rate: 2 });
    expect(result).toMatchObject({ ok: false, error: { code: "speed.unsupported" } });
  });

  it("is undone in one step", async () => {
    const before = doc();
    await freeze();
    kernel.history.undo();
    expect(doc().clips).toEqual(before.clips);
  });
});

describe("speed.reset", () => {
  it("clears speed on the clip and its partner", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], rate: 2 }));
    await run(kernel.bus.run(resetSpeed, { clipIds: ["A"] }));
    expect(clipOf("A")).not.toHaveProperty("speed");
    expect(clipOf("sA")).not.toHaveProperty("speed");
    expect(clipOf("A").duration).toBe(4 * S);
    expect(clipOf("B").start).toBe(4 * S);
  });
});
