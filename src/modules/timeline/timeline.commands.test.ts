import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { createFakeMediaModule, mediaRef } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { createEmptyProject, createProjectModule, projectRef, trackClips } from "@/modules/project";
import { addClip, addTrack, deleteClips, moveClip, splitAt, trimClip } from "./timeline.commands";
import { timelineModule } from "./timeline.module";

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
    previewModule,
    timelineModule,
  ]);
});

describe("timeline commands", () => {
  it("adds clips back to back on the matching track", async () => {
    const a = await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const b = await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const audio = await run(kernel.bus.run(addClip, { mediaId: "ma" }));
    const state = doc();
    expect(a.start).toBe(0);
    expect(b.start).toBe(10 * S);
    expect(state.tracks[a.trackId]!.kind).toBe("video");
    expect(state.tracks[audio.trackId]!.kind).toBe("audio");
  });

  it("refuses overlapping placement with a helpful error", async () => {
    await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const result = await kernel.bus.run(addClip, { mediaId: "mv", start: 5 * S });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("timeline.overlap");
  });

  it("refuses media that is not ready", async () => {
    kernel.modules.require(mediaRef).probes.setState({ probes: { mv: { status: "pending" } } });
    const result = await kernel.bus.run(addClip, { mediaId: "mv" });
    expect(!result.ok && result.error.code).toBe("media.not_ready");
  });

  it("moves clips between tracks of the same kind only", async () => {
    const clip = await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const { trackId } = await run(kernel.bus.run(addTrack, { kind: "video" }));
    const moved = await run(kernel.bus.run(moveClip, { clipId: clip.id, start: 2 * S, trackId }));
    expect(moved).toMatchObject({ trackId, start: 2 * S });
    expect(doc().tracks[clip.trackId]!.clipIds).toEqual([]);

    const audioTrack = kernel.modules
      .require(projectRef)
      .store.getState()
      .trackOrder.find((id) => doc().tracks[id]!.kind === "audio")!;
    const wrong = await kernel.bus.run(moveClip, {
      clipId: clip.id,
      start: 0,
      trackId: audioTrack,
    });
    expect(!wrong.ok && wrong.error.code).toBe("timeline.kind_mismatch");
  });

  it("splits a clip and keeps source offsets continuous", async () => {
    const clip = await run(kernel.bus.run(addClip, { mediaId: "mv", sourceIn: S }));
    const { created } = await run(kernel.bus.run(splitAt, { at: 4 * S }));
    const state = doc();
    const right = state.clips[created[0]!]!;
    expect(state.clips[clip.id]).toMatchObject({ start: 0, sourceIn: S, duration: 4 * S });
    expect(right).toMatchObject({ start: 4 * S, sourceIn: 5 * S, duration: 5 * S });
    expect(trackClips(state, state.tracks[clip.trackId]!).map((c) => c.id)).toEqual([
      clip.id,
      right.id,
    ]);
  });

  it("clamps trims to the source media", async () => {
    const clip = await run(kernel.bus.run(addClip, { mediaId: "mv", duration: 4 * S }));
    const trimmed = await run(
      kernel.bus.run(trimClip, { clipId: clip.id, edge: "end", time: 99 * S }),
    );
    expect(trimmed?.duration).toBe(10 * S);
  });

  it("undoes a split and a delete as single steps", async () => {
    const clip = await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const before = doc();
    const { created } = await run(kernel.bus.run(splitAt, { at: 5 * S }));
    await run(kernel.bus.run(deleteClips, { clipIds: [clip.id, ...created] }));
    expect(Object.keys(doc().clips)).toHaveLength(0);

    kernel.history.undo();
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });
});
