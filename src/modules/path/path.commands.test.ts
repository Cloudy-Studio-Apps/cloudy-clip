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
import { keyframeModule } from "@/modules/keyframe";
import {
  clipTransform,
  createProjectModule,
  followedClip,
  IDENTITY_TRANSFORM,
  projectRef,
  seedProject,
  type Clip,
  type PathPoint,
} from "@/modules/project";
import { createPath, removePaths } from "./path.commands";
import { attachPath } from "./path.follow.commands";
import { pathModule } from "./path.module";

const S = 1_000_000;

const picture = defineElement({
  kind: "test.picture",
  name: "Picture",
  source: "none",
  tracks: ["video"],
  supports: { transform: true, follow: true },
  properties: { content: prop.string() },
  defaults: () => ({ content: "" }),
  display: () => ({ icon: Film, color: "clip-video", label: "Picture", body: "none" }),
});

const transform = defineSharedGroup({
  id: "transform",
  key: "transform",
  label: "Transform",
  order: 900,
  properties: { x: prop.number(), y: prop.number(), rotation: prop.number() },
  defaults: () => ({ ...IDENTITY_TRANSFORM }),
});

const fixtures = defineModule({
  ref: defineModuleRef<Record<string, never>>("path-test-fixtures"),
  name: "fixtures",
  tier: "feature",
  requires: ["element"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(elements, picture);
    contribute(sharedGroups, transform);
    return { api: {} };
  },
});

/** Stands in for a module the keyframe and path modules need only for their UI. */
const stub = (id: string) =>
  defineModule({
    ref: defineModuleRef<Record<string, never>>(id),
    name: id,
    tier: "feature",
    commands: [],
    mcpTools: [],
    setup: () => ({ api: {} }),
  });

const corner = (x: number, y: number): PathPoint => ({ x, y, inX: 0, inY: 0, outX: 0, outY: 0 });
const LINE = [corner(0, 0), corner(300, 0)];

const pictureClip = (id: string, trackId = "v1"): Clip => ({
  id,
  trackId,
  kind: "test.picture",
  start: 0,
  sourceIn: 0,
  duration: 2 * S,
  props: {},
  transform: { ...IDENTITY_TRANSFORM, x: 40, y: 20 },
});

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();

async function ok<T>(
  promise: Promise<{ ok: true; value: unknown } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value as T;
}

async function code(
  promise: Promise<{ ok: true; value: unknown } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (result.ok) throw new Error("expected a failure");
  return result.error.code;
}

const newPath = async (compositionId = "c1") =>
  (await ok<{ pathId: string }>(kernel.bus.run(createPath, { compositionId, points: LINE })))
    .pathId;

beforeEach(async () => {
  kernel = await createKernel();
  const state = seedProject();
  state.clips.a = pictureClip("a");
  state.clips.b = { ...pictureClip("b"), start: 2 * S };
  state.tracks.v1!.clipIds.push("a", "b");
  state.compositions.c2 = { ...state.compositions.c1!, id: "c2", name: "Other", trackOrder: [] };
  state.compositionOrder.push("c2");
  await kernel.modules.loadAll([
    createProjectModule(state),
    elementModule,
    stub("preview"),
    stub("inspector"),
    stub("timeline"),
    stub("media"),
    fixtures,
    keyframeModule,
    pathModule,
  ]);
});

describe("path.attach", () => {
  it("attach keys progress at the clip's ends and zeroes the position", async () => {
    const pathId = await newPath();
    await ok(kernel.bus.run(attachPath, { clipIds: ["a"], pathId }));
    const clip = doc().clips.a!;
    expect(clip.follow?.pathId).toBe(pathId);
    expect(clipTransform(clip)).toMatchObject({ x: 0, y: 0 });
    const keys = clip.animation!["follow.progress"]!.keys;
    expect(keys.map((k) => k.value)).toEqual([0, 1]);
    expect(keys[0]!.t).toBe(0);
  });

  it("attach keeps existing progress keys", async () => {
    const pathId = await newPath();
    await ok(kernel.bus.run(attachPath, { clipIds: ["a"], pathId }));
    const keys = doc().clips.a!.animation!["follow.progress"]!.keys;
    const other = await newPath();
    await ok(kernel.bus.run(attachPath, { clipIds: ["a"], pathId: other }));
    expect(doc().clips.a!.follow?.pathId).toBe(other);
    expect(doc().clips.a!.animation!["follow.progress"]!.keys).toEqual(keys);
  });

  it("attach to another composition's path fails and changes nothing", async () => {
    const pathId = await newPath("c2");
    const before = doc();
    expect(await code(kernel.bus.run(attachPath, { clipIds: ["a"], pathId }))).toBe(
      "path.other_composition",
    );
    expect(doc()).toBe(before);
  });
});

describe("path.remove", () => {
  it("remove bakes followers in one step", async () => {
    const pathId = await newPath();
    await ok(kernel.bus.run(attachPath, { clipIds: ["a"], pathId }));
    const at = S;
    const placed = clipTransform(followedClip(doc().clips.a!, at, doc().paths));
    const attached = doc();
    await ok(kernel.bus.run(removePaths, { pathIds: [pathId], at }));
    const baked = doc().clips.a!;
    expect(baked.follow).toBeUndefined();
    expect(clipTransform(followedClip(baked, at, doc().paths)).x).toBeCloseTo(placed.x);
    expect(doc().paths).toBeUndefined();
    kernel.history.undo();
    expect(doc()).toEqual(attached);
  });
});

describe("path.create", () => {
  it("create with attach is one undo step", async () => {
    await ok(kernel.bus.run(createPath, { points: LINE, attach: ["a", "b"] }));
    expect(doc().clips.b!.follow?.pathId).toBeTruthy();
    kernel.history.undo();
    expect(doc().paths).toBeUndefined();
    expect(doc().clips.a!.follow).toBeUndefined();
    expect(doc().clips.b!.follow).toBeUndefined();
  });
});
