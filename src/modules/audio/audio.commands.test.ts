import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { createProjectModule, projectRef, seedProject, soundOf } from "@/modules/project";
import { addClip, splitAt, timelineModule, trimClip } from "@/modules/timeline";
import { resetSound, setSound } from "./audio.commands";

const S = 1_000_000;
let kernel: Kernel;
const doc = () => kernel.modules.require(projectRef).store.getState();

async function pair() {
  const result = await kernel.bus.run(addClip, { mediaId: "mv", start: 0 });
  if (!result.ok) throw new Error(result.error.code);
  const [video, audio] = result.value.clips;
  return { video: video!, audio: audio! };
}

beforeEach(async () => {
  kernel = await createKernel();
  const project = seedProject();
  project.media.mv = { id: "mv", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.mediaOrder = ["mv"];
  await kernel.modules.loadAll([
    createProjectModule(project),
    elementModule,
    junctionModule,
    createFakeMediaModule({ mv: { status: "ready", duration: 10 * S, width: 1920, height: 1080 } }),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
  ]);
});

describe("clip sound", () => {
  it("setSound on linked clips changes the sound clip only", async () => {
    const { video, audio } = await pair();
    await kernel.bus.run(setSound, { clipIds: [video.id], patch: { volumeDb: -6 } });
    expect(doc().clips[video.id]!.sound).toBeUndefined();
    expect(soundOf(doc().clips[audio.id]!).volumeDb).toBe(-6);
  });

  it("a split keeps fadeIn on the left piece and fadeOut on the right piece", async () => {
    const { audio } = await pair();
    await kernel.bus.run(setSound, {
      clipIds: [audio.id],
      patch: { fadeIn: S, fadeOut: 2 * S, volumeDb: -3 },
    });
    const split = await kernel.bus.run(splitAt, { at: 5 * S, clipIds: [audio.id] });
    if (!split.ok) throw new Error(split.error.code);
    const left = soundOf(doc().clips[audio.id]!);
    const right = soundOf(
      doc().clips[
        split.value.created.find(
          (id) =>
            doc().clips[id]!.mediaId && doc().tracks[doc().clips[id]!.trackId]!.kind === "audio",
        )!
      ]!,
    );
    expect([left.fadeIn, left.fadeOut, left.volumeDb]).toEqual([S, 0, -3]);
    expect([right.fadeIn, right.fadeOut, right.volumeDb]).toEqual([0, 2 * S, -3]);
  });

  it("a fade longer than the clip is clamped", async () => {
    const { audio } = await pair();
    await kernel.bus.run(setSound, { clipIds: [audio.id], patch: { fadeOut: 60 * S } });
    expect(soundOf(doc().clips[audio.id]!).fadeOut).toBe(10 * S);
    await kernel.bus.run(trimClip, { clipId: audio.id, edge: "end", time: 4 * S });
    expect(soundOf(doc().clips[audio.id]!).fadeOut).toBe(doc().clips[audio.id]!.duration);
  });

  it("undo restores in one step, and a default value isn't stored", async () => {
    const { audio } = await pair();
    await kernel.bus.run(setSound, { clipIds: [audio.id], patch: { pan: 0.5, volumeDb: 3 } });
    await kernel.bus.execute("history.undo", {});
    expect(doc().clips[audio.id]!.sound).toBeUndefined();
    await kernel.bus.run(setSound, { clipIds: [audio.id], patch: { pan: 0.5 } });
    await kernel.bus.run(resetSound, { clipIds: [audio.id], section: "pan" });
    expect(doc().clips[audio.id]!.sound).toBeUndefined();
  });
});
