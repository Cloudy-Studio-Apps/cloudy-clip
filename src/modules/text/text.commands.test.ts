import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule, previewRef } from "@/modules/preview";
import { createEmptyProject, createProjectModule, projectRef } from "@/modules/project";
import { addClip, timelineModule } from "@/modules/timeline";
import { addText } from "./text.commands";
import { textModule } from "./text.module";

const S = 1_000_000;
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

beforeEach(async () => {
  kernel = await createKernel();
  const project = createEmptyProject();
  project.media.mv = { id: "mv", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.mediaOrder = ["mv"];
  await kernel.modules.loadAll([
    createProjectModule(project),
    createFakeMediaModule({ mv: { status: "ready", duration: 10 * S, width: 1920, height: 1080 } }),
    previewModule,
    timelineModule,
    textModule,
  ]);
});

describe("text.add", () => {
  it("adds 3 s of the default text at the playhead on the top video track", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" })); // the playhead stays within content
    kernel.modules.require(previewRef).playback.seek(2 * S);
    const clip = await run(kernel.bus.run(addText, {}));
    expect(clip).toMatchObject({ kind: "text", text: "Text", start: 2 * S, duration: 3 * S });
    expect(clip.trackId).toBe(videoTracks()[0]);
  });

  it("opens a new top video track over a video", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const clip = await run(kernel.bus.run(addText, { start: S }));
    expect(videoTracks()).toHaveLength(2);
    expect(clip.trackId).toBe(videoTracks()[0]);
  });

  it("refuses an audio track", async () => {
    const audio = doc().trackOrder.find((id) => doc().tracks[id]!.kind === "audio")!;
    const result = await kernel.bus.run(addText, { trackId: audio });
    expect(!result.ok && result.error.code).toBe("text.kind_mismatch");
  });

  it("refuses a busy named track", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const result = await kernel.bus.run(addText, { start: S, trackId: videoTracks()[0] });
    expect(!result.ok && result.error.code).toBe("timeline.overlap");
  });

  it("undoes adding text, and the track it opened, in one step", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const before = doc();
    await run(kernel.bus.run(addText, { start: S }));
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });
});
