import { Film } from "lucide-react";
import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { defineElement, elementModule, elements, prop } from "@/modules/element";
import { keyframeModule, removeKeys } from "@/modules/keyframe";
import {
  animatedClip,
  createProjectModule,
  IDENTITY_TRANSFORM,
  insertPoint,
  maskOutline,
  projectRef,
  segmentAt,
  seedProject,
  type Clip,
  type KeyTrack,
  type PathPoint,
} from "@/modules/project";
import { addMask, removeMasks, reorderMask, updateMask } from "./mask.commands";
import { setMatte } from "./mask.matte.commands";
import { convertMask, setPoints } from "./mask.points.commands";
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

const COORDS = ["x", "y", "inX", "inY", "outX", "outY"] as const;
const track = (a: number, b: number): KeyTrack => ({
  shared: true,
  blend: "number",
  keys: [
    { id: "ka", t: 0, value: a },
    { id: "kb", t: S, value: b },
  ],
});

/** A clip with a path mask "m" of `n` points "p1".."pn", every coordinate keyed at 0 and 1 s. */
function keyedPathClip(id: string, n: number): Clip {
  const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  const at = (i: number, grow: number): PathPoint => {
    const turn = (2 * Math.PI * i) / n;
    const r = 100 * grow;
    return {
      x: r * Math.cos(turn),
      y: r * Math.sin(turn) * (grow > 1 ? 0.5 : 1),
      inX: 10 * grow,
      inY: -20,
      outX: -10,
      outY: 20 * grow,
    };
  };
  const animation: Record<string, KeyTrack> = {};
  ids.forEach((pid, i) => {
    for (const c of COORDS)
      animation[`masks.m.shape.points.${pid}.${c}`] = track(at(i, 1)[c], at(i, 2)[c]);
  });
  return {
    ...pictureClip(id, "v1"),
    masks: {
      m: {
        id: "m",
        name: "Mask 1",
        color: "orange",
        mode: "add",
        opacity: 1,
        feather: 0,
        expansion: 0,
        x: 0,
        y: 0,
        rotation: 0,
        shape: {
          kind: "path",
          scale: 1,
          points: Object.fromEntries(ids.map((pid, i) => [pid, at(i, 1)])),
          pointOrder: ids,
        },
      },
    },
    maskOrder: ["m"],
    animation,
  };
}

/** The path points of mask "m" in order, at timeline time `t`. */
function pointsAt(clip: Clip, t: number): PathPoint[] {
  const shape = animatedClip(clip, t).masks!.m!.shape;
  if (shape.kind !== "path") throw new Error("not a path");
  return shape.pointOrder.map((pid) => shape.points[pid]!);
}

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
        keys: [{ id: "k1", t: 0, value: 25, ease: { kind: "linear" } }],
      },
      "masks.m1.shape.width": track(100, 300),
    },
  };
  state.tracks.v1!.clipIds.push("t", "q");
  state.clips.t = { ...keyedPathClip("t", 3), start: 4 * S };
  // A step 1 µs after the first key, as keyframe.writeSpan leaves at a span's edge.
  state.clips.t.animation!["masks.m.shape.points.p1.x"]!.keys.splice(1, 0, {
    id: "kc",
    t: 1,
    value: 500,
  });
  state.clips.q = { ...keyedPathClip("q", 4), start: 6 * S };
  state.clips.s = { ...pictureClip("s", "a1"), kind: "test.picture" };
  await kernel.modules.loadAll([
    createProjectModule(state),
    elementModule,
    stub("preview"),
    stub("inspector"),
    stub("timeline"),
    fixtures,
    keyframeModule,
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

  it("removing from a clip with no masks does nothing", async () => {
    const before = doc();
    await ok(kernel.bus.run(removeMasks, { clipId: "a", maskIds: [] }));
    expect(doc()).toBe(before);
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
    const before = doc();
    // Both clips in one call: the one on the matte track would be matted by its own track.
    expect(await code(kernel.bus.run(setMatte, { clipIds: ["a", "b"], trackId: "v2" }))).toBe(
      "mask.own_track",
    );
    expect(doc()).toBe(before);
  });

  it("inserting a point on an animated path keeps every keyed shape", async () => {
    const clip = doc().clips.t!;
    const [p1, p2, p3] = pointsAt(clip, 4 * S);
    const added = insertPoint([p1!, p2!, p3!], 0, 0.5);
    const points = [
      { ...added[0]!, id: "p1" },
      added[1]!,
      { ...added[2]!, id: "p2" },
      { ...added[3]!, id: "p3" },
    ];
    await ok(
      kernel.bus.run(setPoints, {
        clipId: "t",
        maskId: "m",
        points,
        insertAt: { after: "p1", t: 0.5 },
      }),
    );
    const after = doc().clips.t!;
    for (const time of [4 * S, 4 * S + 1, 5 * S]) {
      const old = pointsAt(clip, time);
      const now = pointsAt(after, time);
      expect(now).toHaveLength(4);
      for (let s = 0; s < 3; s++) {
        for (let k = 0; k <= 32; k++) {
          const u = k / 32;
          const want = segmentAt(old, s, u);
          const got =
            s > 0
              ? segmentAt(now, s + 1, u)
              : u <= 0.5
                ? segmentAt(now, 0, u * 2)
                : segmentAt(now, 1, u * 2 - 1);
          expect(got.x).toBeCloseTo(want.x, 6);
          expect(got.y).toBeCloseTo(want.y, 6);
        }
      }
    }
  });

  it("removing a point drops its keys", async () => {
    const [p1, p2, p3] = pointsAt(doc().clips.q!, 6 * S);
    const points = [
      { ...p1!, id: "p1" },
      { ...p2!, id: "p2" },
      { ...p3!, id: "p3" },
    ];
    await ok(kernel.bus.run(setPoints, { clipId: "q", maskId: "m", points }));
    const clip = doc().clips.q!;
    const shape = clip.masks!.m!.shape;
    expect(shape.kind === "path" && shape.pointOrder).toEqual(["p1", "p2", "p3"]);
    expect(Object.keys(clip.animation!).filter((path) => path.includes(".p4."))).toEqual([]);
    expect(Object.keys(clip.animation!)).toHaveLength(18);
  });

  it("converting an animated ellipse keeps its shape at each key", async () => {
    const clip = doc().clips.k!;
    await ok(kernel.bus.run(convertMask, { clipId: "k", maskId: "m1" }));
    const after = doc().clips.k!;
    expect(after.animation!["masks.m1.shape.width"]).toBeUndefined();
    for (const time of [0, S]) {
      const want = maskOutline(animatedClip(clip, time).masks!.m1!)!.flat();
      const got = maskOutline(animatedClip(after, time).masks!.m1!)!.flat();
      expect(got).toHaveLength(want.length);
      got.forEach((p, i) => {
        expect(p.x).toBeCloseTo(want[i]!.x, 6);
        expect(p.y).toBeCloseTo(want[i]!.y, 6);
      });
    }
  });

  it("keying the last key away makes the value static", async () => {
    await ok(
      kernel.bus.run(removeKeys, {
        keys: [{ clipId: "k", path: "masks.m1.feather", keyId: "k1" }],
      }),
    );
    const clip = doc().clips.k!;
    expect(clip.animation!["masks.m1.feather"]).toBeUndefined();
    expect(clip.masks!.m1!.feather).toBe(25);
  });
});
