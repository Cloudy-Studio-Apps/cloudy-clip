import { Film } from "lucide-react";
import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import {
  defineElement,
  defineSharedGroup,
  elementModule,
  elements,
  prop,
  sharedGroups,
} from "@/modules/element";
import {
  createProjectModule,
  mirrorEase,
  presetOf,
  projectRef,
  seedProject,
  type Clip,
} from "@/modules/project";
import { copyKeys, pasteKeys } from "./keyframe.clipboard.commands";
import { clearKeys } from "./keyframe.commands";
import { scaleKeys, setAfter, setEase } from "./keyframe.ease.commands";
import { moveKeys, removeKeys, setKey } from "./keyframe.edit.commands";
import { keyframeModule } from "./keyframe.module";
import { keyframeRef } from "./keyframe.ref";
import type { KeyRef } from "./keyframe.types";

const S = 1_000_000;

const testElement = defineElement({
  kind: "test.keyed",
  name: "Keyed",
  source: "none",
  tracks: ["video"],
  supports: { transform: true },
  properties: { content: prop.string() },
  defaults: () => ({ content: "" }),
  display: () => ({ icon: Film, color: "clip-video", label: "Keyed", body: "none" }),
});

const bareElement = defineElement({
  kind: "test.bare",
  name: "Bare",
  source: "none",
  tracks: ["video"],
  supports: {},
  properties: { content: prop.string() },
  defaults: () => ({ content: "" }),
  display: () => ({ icon: Film, color: "clip-video", label: "Bare", body: "none" }),
});

const group = defineSharedGroup({
  id: "transform",
  key: "transform",
  label: "Transform",
  order: 900,
  properties: {
    x: prop.number(),
    y: prop.number(),
    scale: prop.number({ min: 0.01, max: 20 }),
  },
  defaults: () => ({ x: 0, y: 0, scale: 1, rotation: 0 }),
});

const fixtures = defineModule({
  ref: defineModuleRef<Record<string, never>>("keyframe-test-fixtures"),
  name: "fixtures",
  tier: "feature",
  requires: ["element"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(elements, testElement, bareElement);
    contribute(sharedGroups, group);
    return { api: {} };
  },
});

let kernel: Kernel;
const bus = () => kernel.bus;
const doc = () => kernel.modules.require(projectRef).store.getState();
const clipOf = (id: string) => doc().clips[id]!;
const trackOf = (id: string, path: string) => clipOf(id).animation![path]!;
const keyTime = (ref: KeyRef) =>
  trackOf(ref.clipId, ref.path).keys.find((k) => k.id === ref.keyId)!.t;
const api = () => kernel.modules.require(keyframeRef);

async function run<T>(
  promise: Promise<{ ok: true; value: T } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value;
}

async function code(
  promise: Promise<{ ok: true; value: unknown } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (result.ok) throw new Error("expected a failure");
  return result.error.code;
}

const clip = (id: string, start: number, animation: Clip["animation"]): Clip => ({
  id,
  trackId: "v1",
  kind: "test.keyed",
  props: {},
  start,
  sourceIn: 0,
  duration: 6 * S,
  animation,
});

const keys = (...at: number[]) => at.map((t, i) => ({ id: `k${t / S}`, t, value: (i + 1) * 10 }));

beforeEach(async () => {
  kernel = await createKernel();
  const state = seedProject();
  const clips = [
    clip("a", 2 * S, {
      "transform.x": { blend: "number", shared: true, keys: keys(S, 2 * S, 3 * S) },
    }),
    clip("b", 0, { "transform.x": { blend: "number", shared: true, keys: keys(0, 2 * S) } }),
    clip("only", 0, {
      "transform.x": { blend: "number", shared: true, keys: [{ id: "o", t: S, value: 40 }] },
    }),
    clip("plain", 2 * S, undefined),
    { ...clip("bare", 0, undefined), kind: "test.bare" },
  ];
  for (const c of clips) {
    state.clips[c.id] = c;
    state.tracks.v1!.clipIds.push(c.id);
  }
  await kernel.modules.loadAll([
    createProjectModule(state),
    elementModule,
    fixtures,
    keyframeModule,
  ]);
});

describe("keyframe.set", () => {
  it("adds a key with the current value at a timeline time", async () => {
    const { key } = await run(
      bus().run(setKey, { clipId: "plain", path: "transform.x", at: 3 * S }),
    );
    expect(trackOf("plain", "transform.x").keys).toEqual([
      expect.objectContaining({ id: key, t: S, value: 0 }),
    ]);
  });

  it("copies the field's limits to the track", async () => {
    await run(bus().run(setKey, { clipId: "plain", path: "transform.scale", at: 2 * S }));
    expect(trackOf("plain", "transform.scale")).toMatchObject({
      blend: "number",
      shared: true,
      min: 0.01,
      max: 20,
    });
  });

  it("refuses a field that can't be keyed and a value out of range", async () => {
    expect(await code(bus().run(setKey, { clipId: "plain", path: "content", at: 0 }))).toBe(
      "keyframe.not_keyable",
    );
    expect(
      await code(bus().run(setKey, { clipId: "plain", path: "transform.scale", at: 0, value: 99 })),
    ).toBe("keyframe.invalid_value");
    expect(clipOf("plain").animation).toBeUndefined();
  });
});

describe("keyframe.move", () => {
  const refA = { clipId: "a", path: "transform.x", keyId: "k1" };
  const refB = { clipId: "b", path: "transform.x", keyId: "k2" };

  it("moves keys of two clips as one undo step", async () => {
    const [oldA, oldB] = [keyTime(refA), keyTime(refB)];
    await run(bus().run(moveKeys, { keys: [refA, refB], delta: S }));
    expect(keyTime(refA)).toBe(oldA + S);
    expect(keyTime(refB)).toBe(oldB + S);
    kernel.history.undo();
    expect(keyTime(refA)).toBe(oldA);
    expect(keyTime(refB)).toBe(oldB);
  });

  it("writes nothing when any key is gone", async () => {
    const old = keyTime(refA);
    const failed = await code(
      bus().run(moveKeys, { keys: [refA, { ...refB, keyId: "gone" }], delta: S }),
    );
    expect(failed).toBe("keyframe.not_found");
    expect(keyTime(refA)).toBe(old);
  });
});

describe("keyframe.remove", () => {
  it("forgets selected keys that are gone", async () => {
    const ref = { clipId: "a", path: "transform.x", keyId: "k1" };
    api().view.setState({ selection: [ref] });
    await run(bus().run(removeKeys, { keys: [ref] }));
    expect(api().view.getState().selection).toEqual([]);
  });

  it("leaves the last key's value as the static value", async () => {
    await run(
      bus().run(removeKeys, { keys: [{ clipId: "only", path: "transform.x", keyId: "o" }] }),
    );
    expect(clipOf("only").animation).toBeUndefined();
    expect(clipOf("only").transform!.x).toBe(40);
  });
});

describe("keyframe.clear", () => {
  it("clears a track to the value at `at`", async () => {
    // Clip a starts at 2s; at 3.5s its content is at 1.5s: halfway from 10 to 20.
    await run(bus().run(clearKeys, { clipId: "a", paths: ["transform.x"], at: 3.5 * S }));
    expect(clipOf("a").animation).toBeUndefined();
    expect(clipOf("a").transform!.x).toBeCloseTo(15);
  });
});

describe("keyframe.setEase and setAfter", () => {
  const refA = { clipId: "a", path: "transform.x", keyId: "k1" };
  const refB = { clipId: "a", path: "transform.x", keyId: "k2" };

  it("sets a preset by name on many keys", async () => {
    await run(
      bus().run(setEase, {
        changes: [
          { key: refA, ease: "overshoot" },
          { key: refB, ease: "overshoot", smooth: true },
        ],
      }),
    );
    const keys = trackOf("a", "transform.x").keys;
    expect(presetOf(keys[0]!.ease)).toBe("overshoot");
    expect(keys[1]!.smooth).toBe(true);
  });

  it("loops a field, holds again, and refuses a change with nothing in it", async () => {
    await run(bus().run(setAfter, { clipId: "a", path: "transform.x", after: "loop" }));
    expect(trackOf("a", "transform.x").after).toBe("loop");
    await run(bus().run(setAfter, { clipId: "a", path: "transform.x", after: "hold" }));
    expect(trackOf("a", "transform.x").after).toBeUndefined();
    expect(await code(bus().run(setEase, { changes: [{ key: refA }] }))).toBe(
      "keyframe.invalid_value",
    );
  });
});

describe("keyframe.scale", () => {
  const eased = { kind: "bezier", x1: 0.1, y1: 0.2, x2: 0.3, y2: 0.4 } as const;
  const k = (keyId: string) => ({ clipId: "a", path: "transform.x", keyId });

  it("reverses keys with a negative factor, mirroring their curves", async () => {
    await run(bus().run(setEase, { changes: [{ key: k("k1"), ease: eased }] }));
    // Clip a starts at 2s: content S is timeline 3s. Flipping k1 and k2 around 3s swaps their places.
    await run(bus().run(scaleKeys, { keys: [k("k1"), k("k2")], pivot: 3 * S, factor: -1 }));
    const after = trackOf("a", "transform.x").keys;
    expect(after.map((x) => x.t)).toEqual([0, S, 3 * S]);
    expect(after.map((x) => x.id)).toEqual(["k2", "k1", "k3"]);
    expect(after[0]!.ease).toEqual(mirrorEase(eased));
    expect(after[1]!.ease).toBeUndefined();
  });

  it("refuses a stretch that puts keys on one time", async () => {
    expect(
      await code(bus().run(scaleKeys, { keys: [k("k1"), k("k2")], pivot: 0, factor: 1e-9 })),
    ).toBe("keyframe.invalid_value");
  });
});

describe("keyframe.copy and paste", () => {
  const xKey = { clipId: "a", path: "transform.x", keyId: "k1" };

  it("pastes onto matching paths at a time, and only those", async () => {
    await run(bus().run(copyKeys, { keys: [xKey] }));
    await run(bus().run(pasteKeys, { at: 5 * S, clipIds: ["plain"] }));
    expect(trackOf("plain", "transform.x").keys).toHaveLength(1);
    expect(trackOf("plain", "transform.x").keys[0]!.t).toBe(3 * S);
    expect(await code(bus().run(pasteKeys, { at: 0, clipIds: ["missing"] }))).toBe(
      "keyframe.clip_not_found",
    );
  });

  it("fails with no target when no copied field is on the clip", async () => {
    await run(bus().run(copyKeys, { keys: [xKey] }));
    expect(await code(bus().run(pasteKeys, { at: 0, clipIds: ["bare"] }))).toBe(
      "keyframe.no_target",
    );
  });

  it("keeps each actor's copy apart", async () => {
    await run(bus().run(copyKeys, { keys: [xKey] }));
    expect(api().clipboard.get("agent:other" as never)).toBeUndefined();
  });
});
