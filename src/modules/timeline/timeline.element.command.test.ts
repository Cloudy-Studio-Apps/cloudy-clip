import { beforeEach, describe, expect, it } from "vitest";
import { Type } from "lucide-react";
import { createKernel, defineModule, defineModuleRef, type Kernel } from "@/core";
import {
  defineElement,
  defineSharedGroup,
  elementModule,
  elements,
  prop,
  sharedGroups,
} from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule, previewRef } from "@/modules/preview";
import { createEmptyProject, createProjectModule, projectRef } from "@/modules/project";
import { addClip } from "./timeline.clip.commands";
import { addElement } from "./timeline.element.command";
import { timelineModule } from "./timeline.module";

const S = 1_000_000;
const note = defineElement({
  kind: "note",
  name: "Note",
  source: "none",
  tracks: ["video"],
  supports: { transform: true },
  properties: { text: prop.string(), size: prop.number({ min: 1, max: 100 }) },
  defaults: () => ({ text: "Hi", size: 10 }),
  display: () => ({ icon: Type, color: "clip-type", label: "Note", body: "none" }),
});
/** A stand-in for the transform module's group. */
const transform = defineSharedGroup({
  id: "transform",
  key: "transform",
  label: "Transform",
  order: 900,
  properties: { x: prop.number(), y: prop.number(), scale: prop.number(), rotation: prop.number() },
  defaults: () => ({ x: 0, y: 0, scale: 1, rotation: 0 }),
});
const notes = defineModule({
  ref: defineModuleRef<Record<string, never>>("notes"),
  name: "Notes",
  tier: "feature",
  requires: ["element"],
  setup({ contribute }) {
    contribute(elements, note);
    contribute(sharedGroups, transform);
    return { api: {} };
  },
});

let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();
const videoTracks = () => doc().trackOrder.filter((id) => doc().tracks[id]!.kind === "video");
async function run<T>(
  promise: Promise<{ ok: true; value: T } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value;
}
const code = async (
  input: Parameters<typeof kernel.bus.run<typeof addElement.input, unknown>>[1],
) => {
  const result = await kernel.bus.run(addElement, input);
  return result.ok ? "ok" : result.error.code;
};

beforeEach(async () => {
  kernel = await createKernel();
  const project = createEmptyProject();
  project.media.mv = { id: "mv", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.mediaOrder = ["mv"];
  await kernel.modules.loadAll([
    createProjectModule(project),
    elementModule,
    createFakeMediaModule({ mv: { status: "ready", duration: 10 * S, width: 1920, height: 1080 } }),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    notes,
  ]);
});

describe("timeline.addElement", () => {
  it("adds 3 s at the playhead on the top video track with room", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" })); // the playhead stays within content
    kernel.modules.require(previewRef).playback.seek(2 * S);
    const clip = await run(kernel.bus.run(addElement, { kind: "note" }));
    expect(clip).toMatchObject({
      kind: "note",
      props: {},
      start: 2 * S,
      duration: 3 * S,
      sourceIn: 0,
    });
    expect(clip.trackId).toBe(videoTracks()[0]);
  });

  it("opens a new top video track, and undoes clip and track in one step", async () => {
    const before = doc();
    const clip = await run(kernel.bus.run(addElement, { kind: "note", start: 0 }));
    expect(doc().tracks[clip.trackId]?.kind).toBe("video");
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });

  it("stores the given props minimized, with shared groups", async () => {
    const clip = await run(
      kernel.bus.run(addElement, {
        kind: "note",
        props: { size: 20, text: "Hi", transform: { x: -10, y: 30 } },
      }),
    );
    const stored = doc().clips[clip.id]!;
    expect(stored.props).toEqual({ size: 20 });
    expect(stored.transform).toEqual({ x: -10, y: 30, scale: 1, rotation: 0 });
  });

  it("fails with a code for each mistake", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const audio = doc().trackOrder.find((id) => doc().tracks[id]!.kind === "audio")!;
    expect(await code({ kind: "ghost" })).toBe("element.unknown_kind");
    expect(await code({ kind: "media" })).toBe("timeline.needs_source");
    expect(await code({ kind: "note", trackId: "nope" })).toBe("timeline.track_not_found");
    expect(await code({ kind: "note", trackId: audio })).toBe("timeline.kind_mismatch");
    expect(await code({ kind: "note", start: S, trackId: videoTracks()[0] })).toBe(
      "timeline.overlap",
    );
    expect(await code({ kind: "note", props: { size: 500 } })).toBe("element.invalid_props");
  });

  it("changes nothing when the props are refused", async () => {
    const before = doc();
    await kernel.bus.run(addElement, { kind: "note", props: { size: 500 } });
    expect(doc()).toEqual(before);
  });
});
