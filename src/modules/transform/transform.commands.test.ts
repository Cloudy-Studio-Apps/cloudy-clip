import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { elementModule, setProps } from "@/modules/element";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { createFakeFontsModule } from "@/modules/fonts";
import { inspectorModule } from "@/modules/inspector";
import { previewModule } from "@/modules/preview";
import { createEmptyProject, createProjectModule, projectRef } from "@/modules/project";
import { addClip, splitAt, timelineModule } from "@/modules/timeline";
import { resetTransform } from "./transform.commands";
import { transformModule } from "./transform.module";

const S = 1_000_000;
let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();

async function run<T>(
  promise: Promise<{ ok: true; value: T } | { ok: false; error: { code: string } }>,
) {
  const result = await promise;
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
  return result.value;
}

beforeEach(async () => {
  kernel = await createKernel();
  const project = createEmptyProject();
  project.media.mv = { id: "mv", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.media.ma = { id: "ma", name: "a.mp3", path: "/a.mp3", kind: "audio", size: 1 };
  project.mediaOrder = ["mv", "ma"];
  await kernel.modules.loadAll([
    createProjectModule(project),
    elementModule,
    junctionModule,
    createFakeMediaModule({
      mv: { status: "ready", duration: 10 * S, width: 1920, height: 1080 },
      ma: { status: "ready", duration: 60 * S },
    }),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    inspectorModule,
    transformModule,
  ]);
});

const setTransform = (clipId: string, transform: Record<string, unknown>) =>
  kernel.bus.run(setProps, { clipIds: [clipId], patch: { transform } });

describe("the transform group", () => {
  it("changes only the given fields, brings rotation into range and undoes in one step", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    await run(setTransform(clip.id, { x: 120, scale: 1.5 }));
    await run(setTransform(clip.id, { rotation: 270 }));
    expect(doc().clips[clip.id]!.transform).toEqual({ x: 120, y: 0, scale: 1.5, rotation: -90 });

    kernel.history.undo();
    expect(doc().clips[clip.id]!.transform).toEqual({ x: 120, y: 0, scale: 1.5, rotation: 0 });
  });

  it("removes the transform when it is back to fitted and centered", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    await run(setTransform(clip.id, { y: 40 }));
    await run(setTransform(clip.id, { y: 0 }));
    expect(doc().clips[clip.id]!.transform).toBeUndefined();
  });

  it("refuses clips on an audio track", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "ma" }))).clips[0]!;
    const result = await setTransform(clip.id, { x: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("element.invalid_props");
  });

  it("refuses values out of range", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    const result = await setTransform(clip.id, { scale: 50 });
    expect(!result.ok && result.error.code).toBe("element.invalid_props");
  });

  it("keeps the transform on both halves of a split", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    await run(setTransform(clip.id, { scale: 2 }));
    await run(kernel.bus.run(splitAt, { at: 5 * S }));
    const pictures = Object.values(doc().clips).filter(
      (c) => doc().tracks[c.trackId]?.kind === "video",
    );
    expect(pictures).toHaveLength(2);
    for (const c of pictures) expect(c.transform?.scale).toBe(2);
  });
});

describe("transform.reset", () => {
  it("puts several clips back to fitted and centered in one undo step", async () => {
    const a = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    const b = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    await run(setTransform(a.id, { x: 5 }));
    await run(setTransform(b.id, { y: 5 }));
    await run(kernel.bus.run(resetTransform, { clipIds: [a.id, b.id] }));
    expect(doc().clips[a.id]!.transform).toBeUndefined();
    expect(doc().clips[b.id]!.transform).toBeUndefined();
    kernel.history.undo();
    expect(doc().clips[a.id]!.transform?.x).toBe(5);
    expect(doc().clips[b.id]!.transform?.y).toBe(5);
  });
  it("adds no undo step for a clip that isn't transformed", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    const before = kernel.history.getSnapshot().past.length;
    await run(kernel.bus.run(resetTransform, { clipIds: [clip.id] }));
    expect(kernel.history.getSnapshot().past.length).toBe(before);
  });
  it("fails for a missing clip", async () => {
    const result = await kernel.bus.run(resetTransform, { clipIds: ["nope"] });
    expect(!result.ok && result.error.code).toBe("transform.clip_not_found");
  });
});
