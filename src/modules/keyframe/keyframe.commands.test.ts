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
import { createProjectModule, projectRef, seedProject, type Clip } from "@/modules/project";
import { clearKeys } from "./keyframe.commands";
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
    contribute(elements, testElement);
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
