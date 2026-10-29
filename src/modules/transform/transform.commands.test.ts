import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { createFakeMediaModule } from "@/modules/media";
import { createFakeFontsModule } from "@/modules/fonts";
import { previewModule } from "@/modules/preview";
import { createEmptyProject, createProjectModule, projectRef } from "@/modules/project";
import { addClip, splitAt, timelineModule } from "@/modules/timeline";
import { setClipTransform } from "./transform.commands";
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
    createFakeMediaModule({
      mv: { status: "ready", duration: 10 * S, width: 1920, height: 1080 },
      ma: { status: "ready", duration: 60 * S },
    }),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    transformModule,
  ]);
});

describe("transform.setClipTransform", () => {
  it("changes only the given fields and undoes in one step", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    await run(kernel.bus.run(setClipTransform, { clipId: clip.id, x: 120, scale: 1.5 }));
    await run(kernel.bus.run(setClipTransform, { clipId: clip.id, rotation: 270 }));
    expect(doc().clips[clip.id]!.transform).toEqual({ x: 120, y: 0, scale: 1.5, rotation: -90 });

    await kernel.bus.execute("history.undo", {});
    expect(doc().clips[clip.id]!.transform).toEqual({ x: 120, y: 0, scale: 1.5, rotation: 0 });
  });

  it("resets to fitted and centered", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    await run(kernel.bus.run(setClipTransform, { clipId: clip.id, y: 40 }));
    await run(kernel.bus.run(setClipTransform, { clipId: clip.id, reset: true }));
    expect(doc().clips[clip.id]!.transform).toBeUndefined();
  });

  it("refuses audio clips", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "ma" }))).clips[0]!;
    const result = await kernel.bus.run(setClipTransform, { clipId: clip.id, x: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("transform.not_visual");
  });

  it("keeps the transform on both halves of a split", async () => {
    const clip = (await run(kernel.bus.run(addClip, { mediaId: "mv" }))).clips[0]!;
    await run(kernel.bus.run(setClipTransform, { clipId: clip.id, scale: 2 }));
    await run(kernel.bus.run(splitAt, { at: 5 * S }));
    const pictures = Object.values(doc().clips).filter(
      (c) => doc().tracks[c.trackId]?.kind === "video",
    );
    expect(pictures).toHaveLength(2);
    for (const c of pictures) expect(c.transform?.scale).toBe(2);
  });
});
