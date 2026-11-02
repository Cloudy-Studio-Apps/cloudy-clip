import { Scissors } from "lucide-react";
import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { compositionModule } from "@/modules/composition";
import { elementModule, prop } from "@/modules/element";
import { inspectorModule } from "@/modules/inspector";
import { createFakeFontsModule } from "@/modules/fonts";
import { addJunction, defineJunctionKind, junctionKinds, junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import {
  clearKeys,
  keyframeModule,
  keyframeRef,
  removeKeys,
  setAfter,
  setKey,
} from "@/modules/keyframe";
import { previewModule } from "@/modules/preview";
import {
  RAMP_PATH,
  createProjectModule,
  projectRef,
  seedProject,
  sourceSpan,
  sourceTimeAt,
  staleJunctions,
  type Clip,
  type ProjectState,
} from "@/modules/project";
import { splitAt, timelineModule, trimClip } from "@/modules/timeline";
import { freezeFrame, resetSpeed, setSpeed } from "./speed.commands";
import { speedModule } from "./speed.module";
import { speedRef } from "./speed.ref";

const S = 1_000_000;
const speedOfNormal = { rate: 1, pitchCorrection: true, reversed: false };

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
    compositionModule,
    inspectorModule,
    keyframeModule,
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

  it("refuses when a junction on the clip's start would no longer fit, ripple off", async () => {
    await join();
    const result = await kernel.bus.run(setSpeed, { clipIds: ["B"], rate: 8, ripple: false });
    expect(result).toMatchObject({ ok: false, error: { code: "speed.joined" } });
    expect(staleJunctions(doc())).toEqual([]);
  });

  it("keeps a clip's part of the file when one frame is all that's left", async () => {
    await load((s) => {
      for (const id of ["C", "sC"]) s.clips[id]!.duration = 50_000;
    });
    const { clips } = await run(kernel.bus.run(setSpeed, { clipIds: ["C"], rate: 3 }));
    expect(clips[0]!.rate).toBeLessThan(3);
    expect(sourceSpan(clipOf("C"))).toBeLessThanOrEqual(50_000);
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

  it("stores reversed, and nothing once it's off again", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], reversed: true }));
    expect(clipOf("sA").speed?.reversed).toBe(true);
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], reversed: false }));
    expect(clipOf("A")).not.toHaveProperty("speed");
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

describe("speed ramps", () => {
  const key = (clipId: string, at: number, value: number) =>
    kernel.bus.run(setKey, { clipId, path: RAMP_PATH, at, value });
  const ramp = async () => {
    await run(key("A", 0, 1));
    await run(key("A", S, 4));
  };
  const failure = async (promise: Promise<{ ok: boolean; error?: { code: string } }>) =>
    (await promise).error?.code;

  it("shortens the clip when a ramp speeds it up, and moves what follows, in one undo", async () => {
    const oldDuration = clipOf("A").duration;
    await run(key("A", 0, 1));
    const afterFirstKey = clipOf("B").start;
    await run(key("A", S, 4));
    expect(clipOf("A").duration).toBeLessThan(oldDuration);
    expect(clipOf("B").start).toBe(clipOf("A").start + clipOf("A").duration);
    expect(clipOf("sB").start).toBe(clipOf("B").start);
    kernel.history.undo();
    expect(clipOf("B").start).toBe(afterFirstKey);
    expect(clipOf("A").animation?.[RAMP_PATH]?.keys).toHaveLength(1);
  });

  it("keeps the part of the file it plays", async () => {
    await load((s) => {
      for (const id of ["A", "sA"]) s.clips[id]!.speed = { ...speedOfNormal, rate: 2 };
    });
    const span = sourceSpan(clipOf("A"));
    await run(key("A", 0, 3));
    expect(clipOf("A").duration).toBe(Math.floor(span / 3));
    await run(key("A", S, 0.5));
    // A rate above 1 rounds: a microsecond of the timeline is several of the file.
    expect(span - sourceSpan(clipOf("A"))).toBeGreaterThanOrEqual(0);
    expect(span - sourceSpan(clipOf("A"))).toBeLessThan(10);
  });

  it("gives linked clips the same track and length", async () => {
    await ramp();
    expect(clipOf("sA").animation?.[RAMP_PATH]).toEqual(clipOf("A").animation?.[RAMP_PATH]);
    expect(clipOf("sA").duration).toBe(clipOf("A").duration);
  });

  it("takes an edit from the partner's row", async () => {
    await ramp();
    await run(key("sA", 0, 2));
    expect(clipOf("A").animation?.[RAMP_PATH]?.keys[0]!.value).toBe(2);
    expect(clipOf("A").duration).toBe(clipOf("sA").duration);
    expect(clipOf("B").start).toBe(clipOf("A").duration);
  });

  it("gives a partner with another origin its keys on the same picture", async () => {
    await load((s) => {
      s.clips.A!.animationOrigin = 3 * S;
      s.clips.A!.sourceIn = 3 * S;
      s.clips.sA!.sourceIn = 3 * S;
    });
    await run(key("A", S, 2));
    expect(clipOf("A").animation?.[RAMP_PATH]?.keys[0]!.t).toBe(4 * S);
    expect(clipOf("sA").animation?.[RAMP_PATH]?.keys[0]!.t).toBe(S);
    expect(sourceTimeAt(clipOf("sA"), S)).toBe(sourceTimeAt(clipOf("A"), S));
  });

  it("uses the last Ripple choice", async () => {
    kernel.modules.require(speedRef).view.setState({ ripple: false });
    await ramp();
    expect(clipOf("B").start).toBe(4 * S);
    expect(clipOf("A").duration).toBeLessThan(4 * S);
  });

  it("refuses a slower ramp with no room when ripple is off", async () => {
    kernel.modules.require(speedRef).view.setState({ ripple: false });
    const before = doc().clips;
    expect(await failure(key("A", 0, 0.5))).toBe("timeline.overlap");
    expect(doc().clips).toEqual(before);
  });

  it("refuses a ramp that changes a clip with a transition on its end, ripple off", async () => {
    await join();
    kernel.modules.require(speedRef).view.setState({ ripple: false });
    expect(await failure(key("A", 0, 2))).toBe("speed.joined");
  });

  it("refuses a ramp on a reversed clip", async () => {
    await run(kernel.bus.run(setSpeed, { clipIds: ["A"], reversed: true }));
    const before = doc().clips;
    expect(await failure(key("A", 0, 2))).toBe("speed.reversed_ramp");
    expect(doc().clips).toEqual(before);
  });

  it("refuses to reverse a ramped clip", async () => {
    await ramp();
    const result = kernel.bus.run(setSpeed, { clipIds: ["A"], reversed: true });
    expect(await failure(result)).toBe("speed.reversed_ramp");
  });

  it("refuses a rate or a duration on a ramped clip, naming keyframe_clear", async () => {
    await ramp();
    const rate = await kernel.bus.run(setSpeed, { clipIds: ["sA"], rate: 2 });
    expect(rate).toMatchObject({ ok: false, error: { code: "speed.ramped" } });
    expect(JSON.stringify(rate)).toContain("keyframe_clear");
    const duration = kernel.bus.run(setSpeed, { clipIds: ["A"], duration: S });
    expect(await failure(duration)).toBe("speed.ramped");
  });

  it("offers no speed.rate on a held frame", async () => {
    const { hold } = await run(kernel.bus.run(freezeFrame, { clipId: "A", at: S }));
    const fields = kernel.modules.require(keyframeRef).fieldsOf(clipOf(hold));
    expect(fields.map((field) => field.path)).not.toContain(RAMP_PATH);
    expect(
      kernel.modules
        .require(keyframeRef)
        .fieldsOf(clipOf("A"))
        .map((f) => f.path),
    ).toContain(RAMP_PATH);
  });

  it("refuses a loop on speed.rate", async () => {
    await ramp();
    const result = kernel.bus.run(setAfter, { clipId: "A", path: RAMP_PATH, after: "loop" });
    expect(await failure(result)).toBe("keyframe.no_loop");
  });

  it("clears to one rate, keeping its part of the file, on partners too", async () => {
    await ramp();
    const span = sourceSpan(clipOf("A"));
    await run(kernel.bus.run(clearKeys, { clipId: "A", paths: [RAMP_PATH], at: 0 }));
    expect(clipOf("A")).not.toHaveProperty("speed");
    expect(clipOf("A").duration).toBe(span);
    expect(clipOf("sA").animation).toBeUndefined();
    expect(clipOf("sA").duration).toBe(span);
    expect(clipOf("B").start).toBe(span);
  });

  it("takes the last key's rate when the last key goes", async () => {
    await run(key("A", 0, 2));
    expect(clipOf("A").duration).toBe(2 * S);
    const keyId = clipOf("A").animation![RAMP_PATH]!.keys[0]!.id;
    await run(kernel.bus.run(removeKeys, { keys: [{ clipId: "sA", path: RAMP_PATH, keyId }] }));
    expect(clipOf("A")).toMatchObject({ duration: 2 * S, speed: { rate: 2 } });
    expect(clipOf("sA")).toMatchObject({ duration: 2 * S, speed: { rate: 2 } });
    expect(clipOf("A").animation).toBeUndefined();
  });

  it("is dropped by speed.reset, which goes back to the file's own length", async () => {
    await ramp();
    await run(kernel.bus.run(resetSpeed, { clipIds: ["A"] }));
    expect(clipOf("A").animation).toBeUndefined();
    expect(clipOf("sA").animation).toBeUndefined();
    expect(clipOf("A").duration).toBe(4 * S);
    expect(clipOf("A")).not.toHaveProperty("speed");
    expect(clipOf("B").start).toBe(4 * S);
  });

  it("splits without a jump in the file", async () => {
    await ramp();
    const at = clipOf("A").start + 500_000;
    const whole = clipOf("A");
    const file = sourceTimeAt(whole, at + 100_000);
    const { created } = await run(kernel.bus.run(splitAt, { at, clipIds: ["A"] }));
    const right = created.map(clipOf).find((clip) => clip.trackId === whole.trackId)!;
    expect(right.sourceIn).toBe(sourceTimeAt(whole, at));
    expect(Math.abs(sourceTimeAt(right, at + 100_000) - file)).toBeLessThanOrEqual(1);
  });

  it("trims the end up to the end of the file, not further", async () => {
    await load((s) => {
      for (const id of ["C", "sC"]) s.clips[id]!.sourceIn = 54 * S;
    });
    await run(key("C", 0, 1));
    await run(key("C", S, 4));
    const end = clipOf("C").start + clipOf("C").duration;
    await run(kernel.bus.run(trimClip, { clipId: "C", edge: "end", time: end + 100 * S }));
    const reached = clipOf("C").sourceIn + sourceSpan(clipOf("C"));
    expect(60 * S - reached).toBeGreaterThanOrEqual(0);
    expect(60 * S - reached).toBeLessThan(20);
  });

  it("trims the start without moving the keys off their picture", async () => {
    await ramp();
    const at = 400_000;
    const file = sourceTimeAt(clipOf("A"), at);
    await run(kernel.bus.run(trimClip, { clipId: "A", edge: "start", time: at }));
    expect(clipOf("A")).toMatchObject({ start: at, sourceIn: file });
    expect(clipOf("A").animationOrigin).toBe(file);
    expect(clipOf("sA").animationOrigin).toBe(file);
  });

  it("bakes a hold's values at the time, with no keys of its own", async () => {
    await load((s) => {
      s.clips.A!.animation = {
        "transform.x": {
          blend: "number",
          shared: true,
          keys: [
            { id: "a", t: 0, value: 0 },
            { id: "b", t: 4 * S, value: 400 },
          ],
        },
      };
    });
    await ramp();
    const at = 500_000;
    const file = sourceTimeAt(clipOf("A"), at);
    const { hold } = await run(kernel.bus.run(freezeFrame, { clipId: "A", at }));
    expect(clipOf(hold).animation).toBeUndefined();
    expect(clipOf(hold).sourceIn).toBe(file);
    expect(clipOf(hold).transform?.x).toBeCloseTo((file / S) * 100, 3);
    expect(clipOf(hold).transform?.scale).toBe(1);
    expect(clipOf(hold).speed?.rate).toBe(0);
  });
});
