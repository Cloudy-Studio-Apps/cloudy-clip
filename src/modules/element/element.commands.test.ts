import { Film } from "lucide-react";
import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import { createProjectModule, projectRef, seedProject, type Clip } from "@/modules/project";
import { resetProps, setProps } from "./element.commands";
import { elementModule } from "./element.module";
import { elements, sharedGroups } from "./element.points";
import { elementRef } from "./element.ref";
import { defineElement, defineSharedGroup } from "./logic/define";
import { keyableFields } from "./logic/keyable";
import { prop } from "./logic/props";

const S = 1_000_000;

const testElement = defineElement({
  kind: "test.keyed",
  name: "Keyed",
  source: "none",
  tracks: ["video"],
  supports: { transform: true },
  properties: {
    amount: prop.number({ min: 0, max: 10 }),
    tint: prop.color(),
    content: prop.string(),
    locked: prop.number({ readOnly: true }),
    still: prop.number({ keyframes: false }),
  },
  defaults: () => ({ amount: 1, tint: "#ffffff", content: "", locked: 0, still: 0 }),
  display: () => ({ icon: Film, color: "clip-video", label: "Keyed", body: "none" }),
});

const group = defineSharedGroup({
  id: "transform",
  key: "transform",
  label: "Transform",
  order: 900,
  properties: { x: prop.number(), y: prop.number() },
  defaults: () => ({ x: 0, y: 0, scale: 1, rotation: 0 }),
  appliesTo: (_clip, track) => track.kind === "video",
});

const fixtures = defineModule({
  ref: defineModuleRef<Record<string, never>>("element-test-fixtures"),
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
const id = "k";
const clipOf = (clipId: string) =>
  kernel.modules.require(projectRef).store.getState().clips[clipId]!;

async function run<T>(
  promise: Promise<{ ok: true; value: T } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value;
}

beforeEach(async () => {
  kernel = await createKernel();
  const state = seedProject();
  const clip: Clip = {
    id,
    trackId: "v1",
    kind: "test.keyed",
    props: {},
    start: 0,
    sourceIn: 0,
    duration: 4 * S,
    animation: {
      "transform.x": {
        blend: "number",
        shared: true,
        keys: [{ id: "k0", t: 0, value: 0 }],
      },
    },
  };
  state.clips[id] = clip;
  state.tracks.v1!.clipIds.push(id);
  await kernel.modules.loadAll([createProjectModule(state), elementModule, fixtures]);
});

describe("element.setProps with keys", () => {
  it("writes a key at `at` for an animated field, and a static value for the rest", async () => {
    await run(
      kernel.bus.run(setProps, { clipIds: [id], patch: { transform: { x: 40, y: 7 } }, at: 2 * S }),
    );
    const clip = clipOf(id);
    expect(clip.animation!["transform.x"]!.keys.map((k) => k.value)).toEqual([0, 40]);
    expect(clip.transform!.y).toBe(7);
  });

  it("refuses an animated field without `at`", async () => {
    const failed = await kernel.bus.run(setProps, {
      clipIds: [id],
      patch: { transform: { x: 40 } },
    });
    if (failed.ok) throw new Error("expected a failure");
    expect(failed.error.code).toBe("element.animated");
    expect(failed.error.message).toContain("keyframe_set");
  });

  it("lands on the clip's last frame when the playhead is past it", async () => {
    await run(
      kernel.bus.run(setProps, { clipIds: [id], patch: { transform: { x: 40 } }, at: 99 * S }),
    );
    const times = clipOf(id).animation!["transform.x"]!.keys.map((k) => k.t);
    expect(Math.max(...times)).toBeLessThan(clipOf(id).duration);
  });
});

describe("element.resetProps with keys", () => {
  it("removes tracks with what it resets", async () => {
    await run(kernel.bus.run(resetProps, { clipIds: [id], paths: ["transform"] }));
    expect(clipOf(id).animation).toBeUndefined();
  });
});

describe("keyableFields", () => {
  it("lists numbers, colors, enums and booleans, and not text, read-only or opted-out fields", () => {
    const element = kernel.modules.require(elementRef).get("test.keyed")!;
    const state = kernel.modules.require(projectRef).store.getState();
    const paths = keyableFields(element, state.clips[id]!, state.tracks.v1!).map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["amount", "tint", "transform.x"]));
    for (const hidden of ["content", "locked", "still"]) expect(paths).not.toContain(hidden);
  });
});
