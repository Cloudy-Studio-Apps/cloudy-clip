import { beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { createKernel, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule, mediaRef } from "@/modules/media";
import { createFakeFontsModule } from "@/modules/fonts";
import { previewModule } from "@/modules/preview";
import {
  createProjectModule,
  projectRef,
  seedProject,
  trackClips,
  type ProjectState,
} from "@/modules/project";
import { snapCandidates } from "./logic/placement";
import {
  addClip,
  addTrack,
  deleteClips,
  moveClip,
  removeTrack,
  setTrackMuted,
  splitAt,
  trimClip,
  unlinkClips,
} from "./timeline.commands";
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

/** Adds media and returns the first clip (the picture for a video). */
async function place(input: z.input<typeof addClip.input>) {
  return (await run(kernel.bus.run(addClip, input))).clips[0]!;
}

/** Adds the video "mv" (10 s) as a linked pair at `start`. */
async function pair(start = 0) {
  const [video, audio] = (await run(kernel.bus.run(addClip, { mediaId: "mv", start }))).clips;
  return { video: video!, audio: audio! };
}

const trackOfKind = (kind: "video" | "audio", nth = 0) =>
  doc().compositions.c1!.trackOrder.filter((id) => doc().tracks[id]!.kind === kind)[nth]!;

beforeEach(async () => {
  kernel = await createKernel();
  const project = seedProject();
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
  ]);
});

describe("timeline commands", () => {
  it("adds clips back to back on the matching track", async () => {
    const a = await place({ mediaId: "mv" });
    const b = await place({ mediaId: "mv" });
    const audio = await place({ mediaId: "ma" });
    const state = doc();
    expect(a.start).toBe(0);
    expect(b.start).toBe(10 * S);
    expect(state.tracks[a.trackId]!.kind).toBe("video");
    expect(state.tracks[audio.trackId]!.kind).toBe("audio");
  });

  it("adds a video as a linked picture and sound pair", async () => {
    const { clips } = await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    const [video, audio] = clips;
    const state = doc();
    expect(clips).toHaveLength(2);
    expect(state.tracks[video!.trackId]!.kind).toBe("video");
    expect(state.tracks[audio!.trackId]!.kind).toBe("audio");
    expect(audio).toMatchObject({
      mediaId: "mv",
      start: video!.start,
      sourceIn: video!.sourceIn,
      duration: video!.duration,
    });
    expect(video!.linkId).toBeDefined();
    expect(audio!.linkId).toBe(video!.linkId);
  });

  it("adds only a picture for a video without sound", async () => {
    kernel.modules.require(mediaRef).probes.setState({
      probes: {
        mv: {
          status: "ready",
          duration: 10 * S,
          proxy: { state: "skipped", hasAudio: false },
        },
      },
    });
    const { clips } = await run(kernel.bus.run(addClip, { mediaId: "mv" }));
    expect(clips).toHaveLength(1);
    expect(clips[0]!.linkId).toBeUndefined();
  });

  it("adds one clip for an audio file", async () => {
    const { clips } = await run(kernel.bus.run(addClip, { mediaId: "ma" }));
    expect(clips).toHaveLength(1);
    expect(doc().tracks[clips[0]!.trackId]!.kind).toBe("audio");
  });

  it("puts the sound on a new audio track when the first is busy", async () => {
    await place({ mediaId: "ma" });
    const { clips } = await run(kernel.bus.run(addClip, { mediaId: "mv", start: 0 }));
    expect(clips[1]!.trackId).toBe(trackOfKind("audio", 1));
  });

  it("a video dropped on an audio track puts its sound there", async () => {
    const { trackId } = await run(kernel.bus.run(addTrack, { kind: "audio" }));
    const { clips } = await run(kernel.bus.run(addClip, { mediaId: "mv", trackId }));
    expect(clips[1]!.trackId).toBe(trackId);
    expect(doc().tracks[clips[0]!.trackId]!.kind).toBe("video");
  });

  it("a video dropped on an audio track opens a video track when the first is busy", async () => {
    await place({ mediaId: "mv" });
    const { trackId } = await run(kernel.bus.run(addTrack, { kind: "audio" }));
    const { clips } = await run(kernel.bus.run(addClip, { mediaId: "mv", start: 0, trackId }));
    expect(clips[0]!.trackId).toBe(trackOfKind("video", 0));
    expect(
      doc().compositions.c1!.trackOrder.filter((id) => doc().tracks[id]!.kind === "video"),
    ).toHaveLength(2);
  });

  it("undoes adding a pair in one step", async () => {
    const before = doc();
    await place({ mediaId: "mv" });
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });

  it("refuses overlapping placement with a helpful error", async () => {
    await place({ mediaId: "mv" });
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
    const clip = await place({ mediaId: "mv" });
    const { trackId } = await run(kernel.bus.run(addTrack, { kind: "video" }));
    const moved = await run(kernel.bus.run(moveClip, { clipId: clip.id, start: 2 * S, trackId }));
    expect(moved).toMatchObject({ trackId, start: 2 * S });
    expect(doc().tracks[clip.trackId]!.clipIds).toEqual([]);

    const audioTrack = kernel.modules
      .require(projectRef)
      .store.getState()
      .compositions.c1!.trackOrder.find((id) => doc().tracks[id]!.kind === "audio")!;
    const wrong = await kernel.bus.run(moveClip, {
      clipId: clip.id,
      start: 0,
      trackId: audioTrack,
    });
    expect(!wrong.ok && wrong.error.code).toBe("timeline.kind_mismatch");
  });

  it("splits a clip and keeps source offsets continuous", async () => {
    const clip = await place({ mediaId: "mv", sourceIn: S });
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
    const clip = await place({ mediaId: "mv", duration: 4 * S });
    const trimmed = await run(
      kernel.bus.run(trimClip, { clipId: clip.id, edge: "end", time: 99 * S }),
    );
    expect(trimmed?.duration).toBe(10 * S);
  });

  it("undoes a split and a delete as single steps", async () => {
    const clip = await place({ mediaId: "mv" });
    const before = doc();
    const { created } = await run(kernel.bus.run(splitAt, { at: 5 * S }));
    await run(kernel.bus.run(deleteClips, { clipIds: [clip.id, ...created] }));
    expect(Object.keys(doc().clips)).toHaveLength(0);

    kernel.history.undo();
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });
});

describe("text clips", () => {
  /** Puts a text clip on the first video track (adding text is the text module's command). */
  function addText(start: number, duration: number) {
    const store = kernel.modules.require(projectRef).store;
    const trackId = trackOfKind("video");
    store.api.setState((s) => ({
      clips: {
        ...s.clips,
        t: {
          id: "t",
          kind: "text",
          props: { text: "Text" },
          trackId,
          start,
          sourceIn: 0,
          duration,
        },
      },
      tracks: { ...s.tracks, [trackId]: { ...s.tracks[trackId]!, clipIds: ["t"] } },
    }));
  }

  it("splits a text clip into two text clips", async () => {
    addText(0, 4 * S);
    const { created } = await run(kernel.bus.run(splitAt, { at: S }));
    expect(doc().clips[created[0]!]).toMatchObject({
      kind: "text",
      props: { text: "Text" },
      start: S,
      sourceIn: 0,
      duration: 3 * S,
    });
  });

  it("gives each half of a split text its own copy of the props", async () => {
    addText(0, 4 * S);
    const { created } = await run(kernel.bus.run(splitAt, { at: S }));
    const left = doc().clips.t!;
    const right = doc().clips[created[0]!]!;
    expect(right.props).toEqual(left.props);
    expect(right.props).not.toBe(left.props);
  });

  it("trims a text clip longer than any file", async () => {
    addText(0, 4 * S);
    await run(kernel.bus.run(trimClip, { clipId: "t", edge: "end", time: 99 * S }));
    expect(doc().clips.t!.duration).toBe(99 * S);
  });

  it("trims a text clip's start without moving a source", async () => {
    addText(2 * S, 4 * S);
    await run(kernel.bus.run(trimClip, { clipId: "t", edge: "start", time: 3 * S }));
    expect(doc().clips.t).toMatchObject({ start: 3 * S, duration: 3 * S, sourceIn: 0 });
  });
});

describe("linked clips", () => {
  it("moves linked clips together", async () => {
    const { video, audio } = await pair();
    await run(kernel.bus.run(moveClip, { clipId: video.id, start: 3 * S }));
    expect(doc().clips[audio.id]!.start).toBe(3 * S);
  });

  it("refuses a linked move when the partner would overlap", async () => {
    const { video, audio } = await pair();
    await place({ mediaId: "ma", start: 12 * S, trackId: audio.trackId, duration: 8 * S });
    const before = doc();
    const result = await kernel.bus.run(moveClip, { clipId: video.id, start: 5 * S });
    expect(!result.ok && result.error.code).toBe("timeline.overlap");
    expect(doc()).toEqual(before);
  });

  it("moves only the dragged clip to another track", async () => {
    const { video, audio } = await pair();
    const { trackId } = await run(kernel.bus.run(addTrack, { kind: "video" }));
    await run(kernel.bus.run(moveClip, { clipId: video.id, start: 2 * S, trackId }));
    expect(doc().clips[video.id]).toMatchObject({ trackId, start: 2 * S });
    expect(doc().clips[audio.id]).toMatchObject({ trackId: audio.trackId, start: 2 * S });
  });

  it("trims linked clips to the same edge", async () => {
    const { video, audio } = await pair();
    await run(kernel.bus.run(trimClip, { clipId: video.id, edge: "end", time: 6 * S }));
    await place({ mediaId: "ma", start: 8 * S, trackId: audio.trackId, duration: S });
    await run(kernel.bus.run(trimClip, { clipId: video.id, edge: "end", time: 9 * S }));
    expect(doc().clips[video.id]!.duration).toBe(8 * S);
    expect(doc().clips[audio.id]!.duration).toBe(8 * S);
  });

  it("splits the partner too and links the halves", async () => {
    const { video, audio } = await pair();
    const { created } = await run(kernel.bus.run(splitAt, { at: 5 * S, clipIds: [audio.id] }));
    const state = doc();
    expect(Object.keys(state.clips)).toHaveLength(4);
    const [right1, right2] = created.map((id) => state.clips[id]!);
    expect(state.clips[video.id]!.linkId).toBe(state.clips[audio.id]!.linkId);
    expect(right1!.linkId).toBeDefined();
    expect(right1!.linkId).toBe(right2!.linkId);
    expect(right1!.linkId).not.toBe(video.linkId);
  });

  it("deletes the partner too", async () => {
    const { audio } = await pair();
    await run(kernel.bus.run(deleteClips, { clipIds: [audio.id] }));
    expect(Object.keys(doc().clips)).toHaveLength(0);
  });

  it("unlinks, then edits alone, and undo relinks", async () => {
    const { video, audio } = await pair();
    const before = doc();
    await run(kernel.bus.run(unlinkClips, { clipIds: [video.id] }));
    expect(doc().clips[video.id]!.linkId).toBeUndefined();
    expect(doc().clips[audio.id]!.linkId).toBeUndefined();
    await run(kernel.bus.run(moveClip, { clipId: video.id, start: 4 * S }));
    expect(doc().clips[audio.id]!.start).toBe(0);
    kernel.history.undo();
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });

  it("unlink fails when nothing is linked", async () => {
    const clip = await place({ mediaId: "ma" });
    const result = await kernel.bus.run(unlinkClips, { clipIds: [clip.id] });
    expect(!result.ok && result.error.code).toBe("timeline.not_linked");
  });

  it("a clip whose partner's track was removed edits alone", async () => {
    const { video, audio } = await pair();
    await run(kernel.bus.run(removeTrack, { trackId: audio.trackId }));
    await run(kernel.bus.run(moveClip, { clipId: video.id, start: 2 * S }));
    expect(doc().clips[video.id]!.start).toBe(2 * S);
  });

  it("refuses muting a video track", async () => {
    const result = await kernel.bus.run(setTrackMuted, {
      trackId: trackOfKind("video"),
      muted: true,
    });
    expect(!result.ok && result.error.code).toBe("timeline.kind_mismatch");
  });

  describe("with a second composition", () => {
    const seedSecond = () => {
      const { store } = kernel.modules.require(projectRef);
      (store as unknown as { reset(state: ProjectState): void }).reset({
        ...doc(),
        compositions: {
          ...doc().compositions,
          c2: { ...doc().compositions.c1!, id: "c2", trackOrder: ["other"] },
        },
        tracks: {
          ...doc().tracks,
          other: {
            id: "other",
            compositionId: "c2",
            kind: "video",
            name: "Other",
            clipIds: ["far"],
            muted: false,
            hidden: false,
          },
        },
        clips: {
          ...doc().clips,
          far: {
            id: "far",
            kind: "text",
            trackId: "other",
            start: 0,
            sourceIn: 0,
            duration: 2 * S,
            props: {},
          },
        },
      });
    };

    it("splits only the open composition when no clips are named", async () => {
      await place({ mediaId: "mv" });
      seedSecond();
      expect((await kernel.bus.run(splitAt, { at: S })).ok).toBe(true);
      expect(doc().tracks.other!.clipIds).toEqual(["far"]);
    });

    it("snaps only to clips of the composition", () => {
      seedSecond();
      expect(snapCandidates(doc(), "c1", 0)).not.toContain(2 * S);
    });

    it("refuses to move a clip into another composition", async () => {
      const clip = await place({ mediaId: "ma" });
      seedSecond();
      const result = await kernel.bus.run(moveClip, {
        clipId: clip.id,
        start: 0,
        trackId: "other",
      });
      expect(!result.ok && result.error.code).toBe("timeline.kind_mismatch");
      const video = await place({ mediaId: "mv" });
      const moved = await kernel.bus.run(moveClip, {
        clipId: video.id,
        start: 0,
        trackId: "other",
      });
      expect(!moved.ok && moved.error.code).toBe("timeline.other_composition");
    });
  });
});
