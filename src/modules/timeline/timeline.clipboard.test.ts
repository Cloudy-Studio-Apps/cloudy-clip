import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, keybindings, pagesRef, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule, MEDIA_PAGE } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import { createProjectModule, partnersOf, projectRef, seedProject } from "@/modules/project";
import { addClip, addTrack } from "./timeline.commands";
import { copyClips, cutClips, duplicateClips, pasteClips } from "./timeline.clipboard.commands";
import { timelineModule } from "./timeline.module";
import { timelineRef } from "./timeline.ref";

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

const sound = async (start: number, duration: number, trackId?: string) =>
  (
    await run(
      kernel.bus.run(addClip, {
        mediaId: "ma",
        start: start * S,
        duration: duration * S,
        ...(trackId && { trackId }),
      }),
    )
  ).clips[0]!;

beforeEach(async () => {
  kernel = await createKernel();
  const project = seedProject();
  project.media.mv = { id: "mv", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 };
  project.media.ma = { id: "ma", name: "a.mp3", path: "/a.mp3", kind: "audio", size: 1 };
  project.mediaOrder = ["mv", "ma"];
  project.compositions.c2 = { ...project.compositions.c1!, id: "c2", trackOrder: ["t2"] };
  project.tracks.t2 = {
    id: "t2",
    compositionId: "c2",
    kind: "video",
    name: "Video",
    clipIds: [],
    muted: false,
    hidden: false,
  };
  project.compositions.c1!.trackOrder = ["v1", "a1"];
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
  ]);
});

describe("paste", () => {
  it("keeps spacing and gives new ids", async () => {
    const a = await sound(0, 2);
    const b = await sound(3, 2);
    await run(kernel.bus.run(copyClips, { clipIds: [a.id, b.id] }));
    const { clips } = await run(kernel.bus.run(pasteClips, { time: 10 * S }));
    expect(clips.map((c) => c.start / S)).toEqual([10, 13]);
    expect(clips.map((c) => c.id)).not.toContain(a.id);
    expect(clips.every((c) => c.trackId === a.trackId)).toBe(true);
  });

  it("keeps a linked pair linked under a new link", async () => {
    const { clips } = await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    await run(kernel.bus.run(copyClips, { clipIds: [clips[0]!.id] }));
    const pasted = (await run(kernel.bus.run(pasteClips, { time: 20 * S }))).clips;
    expect(pasted).toHaveLength(2);
    expect(pasted[0]!.linkId).not.toBe(clips[0]!.linkId);
    expect(partnersOf(doc(), pasted[0]!.id).map((c) => c.id)).toEqual([pasted[1]!.id]);
  });

  it("goes to the first free track of its kind when the original is taken", async () => {
    const a = await sound(0, 5);
    const { trackId } = await run(kernel.bus.run(addTrack, { kind: "audio" }));
    await run(kernel.bus.run(copyClips, { clipIds: [a.id] }));
    const { clips } = await run(kernel.bus.run(pasteClips, { time: 2 * S }));
    expect(clips[0]!.trackId).toBe(trackId);
  });

  it("makes a new track when none has room, and one undo removes both", async () => {
    const a = await sound(0, 5);
    await run(kernel.bus.run(copyClips, { clipIds: [a.id] }));
    const tracks = doc().compositions.c1!.trackOrder.length;
    const { clips } = await run(kernel.bus.run(pasteClips, { time: 2 * S }));
    expect(doc().compositions.c1!.trackOrder).toHaveLength(tracks + 1);
    kernel.history.undo();
    expect(doc().compositions.c1!.trackOrder).toHaveLength(tracks);
    expect(doc().clips[clips[0]!.id]).toBeUndefined();
  });

  it("anchors the first clip on trackId, the rest keep their distance in tracks", async () => {
    const { trackId: a2 } = await run(kernel.bus.run(addTrack, { kind: "audio" }));
    const { trackId: a3 } = await run(kernel.bus.run(addTrack, { kind: "audio" }));
    const audio = doc().compositions.c1!.trackOrder.filter(
      (id) => doc().tracks[id]!.kind === "audio",
    );
    const a = await sound(0, 2, audio[0]);
    const b = await sound(0, 2, audio[1]);
    expect(new Set([a2, a3, ...audio]).size).toBe(3);
    await run(kernel.bus.run(copyClips, { clipIds: [a.id, b.id] }));
    const { clips } = await run(kernel.bus.run(pasteClips, { time: 8 * S, trackId: audio[1]! }));
    expect(clips.map((c) => c.trackId).sort()).toEqual([audio[1], audio[2]].sort());
  });

  it("puts clips that overlapped under a junction one after the other", async () => {
    const a = await sound(0, 4);
    const b = await sound(4, 4);
    kernel.modules.require(timelineRef).clipboard.set("local", {
      clips: [
        { ...a, start: 0 },
        { ...b, start: 3 * S },
      ],
      origin: 0,
      trackKinds: { [a.trackId]: "audio", v1: "video" },
    });
    const { clips } = await run(kernel.bus.run(pasteClips, { time: 20 * S }));
    expect(clips.map((c) => c.start / S)).toEqual([20, 24]);
  });

  it("refuses a composition into one it contains", async () => {
    const a = await sound(0, 2);
    kernel.modules.require(timelineRef).clipboard.set("local", {
      clips: [{ ...a, mediaId: undefined, compositionRef: "c2", trackId: "v1" }] as never,
      origin: 0,
      trackKinds: { [a.trackId]: "audio", v1: "video" },
    });
    const result = await kernel.bus.run(pasteClips, { time: 0, trackId: "t2" });
    expect(result).toMatchObject({ ok: false, error: { code: "composition.cycle" } });
  });

  it("fails when the copied file is gone, writing nothing", async () => {
    const a = await sound(0, 2);
    kernel.modules.require(timelineRef).clipboard.set("local", {
      clips: [{ ...a, mediaId: "gone" }],
      origin: 0,
      trackKinds: { [a.trackId]: "audio", v1: "video" },
    });
    const before = doc();
    const result = await kernel.bus.run(pasteClips, { time: 9 * S });
    expect(result).toMatchObject({ ok: false, error: { code: "timeline.clipboard_stale" } });
    expect(doc()).toBe(before);
  });

  it("fails with nothing copied", async () => {
    const result = await kernel.bus.run(pasteClips, {});
    expect(result).toMatchObject({ ok: false, error: { code: "timeline.clipboard_empty" } });
  });
});

describe("the clipboard", () => {
  it("is per actor", async () => {
    const mine = await sound(0, 2);
    const theirs = await sound(2, 3);
    await run(kernel.bus.run(copyClips, { clipIds: [mine.id] }));
    await run(kernel.bus.run(copyClips, { clipIds: [theirs.id] }, { actor: "agent" }));
    const { clips } = await run(kernel.bus.run(pasteClips, { time: 20 * S }));
    expect(clips[0]!.duration).toBe(2 * S);
  });

  it("cut is one undo step", async () => {
    const a = await sound(0, 2);
    await run(kernel.bus.run(cutClips, { clipIds: [a.id] }));
    expect(doc().clips[a.id]).toBeUndefined();
    kernel.history.undo();
    expect(doc().clips[a.id]).toBeDefined();
  });

  it("duplicate lands right after the selection, on its track", async () => {
    const a = await sound(0, 2);
    const { clips } = await run(kernel.bus.run(duplicateClips, { clipIds: [a.id] }));
    expect(clips[0]).toMatchObject({ start: 2 * S, trackId: a.trackId });
  });

  it("the copy shortcut does nothing off the Edit page", async () => {
    const a = await sound(0, 2);
    kernel.modules.require(timelineRef).selectClip(a.id);
    const copy = kernel.points.get(keybindings).find((k) => k.id === "timeline.copy")!;
    expect(copy.resolve()).not.toBeNull();
    kernel.modules.require(pagesRef).store.setState({ active: MEDIA_PAGE });
    expect(copy.resolve()).toBeNull();
  });
});
