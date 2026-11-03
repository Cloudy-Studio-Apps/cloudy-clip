import { beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { Volume2 } from "lucide-react";
import {
  appPages,
  createKernel,
  defineModule,
  defineModuleRef,
  keybindings,
  showPage,
  type Kernel,
} from "@/core";
import { elementModule } from "@/modules/element";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule, mediaRef } from "@/modules/media";
import { createFakeFontsModule } from "@/modules/fonts";
import { previewModule } from "@/modules/preview";
import {
  animatedClip,
  clipTransform,
  contentTime,
  createProjectModule,
  partnersOf,
  projectRef,
  seedProject,
  trackClips,
  type Clip,
  type ProjectState,
} from "@/modules/project";
import { snapCandidates } from "./logic/placement";
import {
  addClip,
  addTrack,
  deleteClips,
  linkClips,
  moveClip,
  removeTrack,
  rippleDelete,
  setClipsDisabled,
  setTrackMuted,
  splitAt,
  trimClip,
  unlinkClips,
} from "./timeline.commands";
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
  project.media.mi = { id: "mi", name: "a.png", path: "/a.png", kind: "image", size: 1 };
  project.mediaOrder = ["mv", "ma", "mi"];
  await kernel.modules.loadAll([
    createProjectModule(project),
    elementModule,
    junctionModule,
    createFakeMediaModule({
      mv: { status: "ready", duration: 10 * S, width: 1920, height: 1080 },
      ma: { status: "ready", duration: 60 * S },
      mi: { status: "ready", duration: 5 * S, width: 800, height: 600 },
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

  it("adds a track at a position, and undo takes it out", async () => {
    const before = doc().compositions.c1!.trackOrder;
    const { trackId } = await run(kernel.bus.run(addTrack, { kind: "video", index: 1 }));
    expect(doc().compositions.c1!.trackOrder).toEqual([before[0], trackId, ...before.slice(1)]);
    await kernel.bus.execute("history.undo", {});
    expect(doc().compositions.c1!.trackOrder).toEqual(before);
  });

  it("keeps video tracks above audio tracks, wherever an index points", async () => {
    const video = await run(kernel.bus.run(addTrack, { kind: "video", index: 99 }));
    const audio = await run(kernel.bus.run(addTrack, { kind: "audio", index: 0 }));
    expect(doc().compositions.c1!.trackOrder).toEqual(["v1", video.trackId, audio.trackId, "a1"]);
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

describe("keys on a clip", () => {
  /** A 4 s clip whose x slides from 0 to 40 along its picture. */
  async function keyed() {
    const clip = await place({ mediaId: "mv", start: 2 * S });
    const animation = {
      "transform.x": {
        blend: "number" as const,
        shared: true as const,
        keys: [
          { id: "k0", t: 0, value: 0 },
          { id: "k1", t: 4 * S, value: 40 },
        ],
      },
    };
    kernel.modules.require(projectRef).store.api.setState((s) => ({
      clips: { ...s.clips, [clip.id]: { ...s.clips[clip.id]!, duration: 4 * S, animation } },
    }));
    return clip.id;
  }
  const clipOf = (id: string) => doc().clips[id]!;

  it("keeps keys on the picture through a left trim", async () => {
    const id = await keyed();
    const before = animatedClip(clipOf(id), 5 * S);
    await run(kernel.bus.run(trimClip, { clipId: id, edge: "start", time: 4 * S }));
    expect(clipOf(id).start).toBe(4 * S);
    expect(clipTransform(animatedClip(clipOf(id), 5 * S))).toEqual(clipTransform(before));
  });

  it("gives both halves of a split the same curve", async () => {
    const id = await keyed();
    const { created } = await run(kernel.bus.run(splitAt, { at: 5 * S, clipIds: [id] }));
    const right = clipOf(created[0]!);
    expect(right.animation).toEqual(clipOf(id).animation);
    expect(right.animation).not.toBe(clipOf(id).animation);
    expect(contentTime(right, 5 * S)).toBe(contentTime(clipOf(id), 5 * S));
    expect(contentTime(right, 5 * S)).toBe(3 * S);
  });

  it("gives both halves of a split the same composite", async () => {
    const id = await keyed();
    const composite = { mode: "screen", opacity: 0.5 } as const;
    kernel.modules.require(projectRef).store.api.setState((s) => ({
      clips: { ...s.clips, [id]: { ...s.clips[id]!, composite } },
    }));
    const { created } = await run(kernel.bus.run(splitAt, { at: 5 * S, clipIds: [id] }));
    expect(clipOf(created[0]!).composite).toEqual(composite);
    expect(clipOf(created[0]!).composite).not.toBe(clipOf(id).composite);
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

  describe("soundOnly", () => {
    it("deletes only the sound of a linked pair, in one undo step", async () => {
      const { video, audio } = await pair();
      const before = doc();
      await run(kernel.bus.run(deleteClips, { clipIds: [audio.id], soundOnly: true }));
      expect(doc().clips[video.id]).toBeDefined();
      expect(doc().clips[video.id]!.linkId).toBeUndefined();
      expect(doc().clips[audio.id]).toBeUndefined();
      kernel.history.undo();
      expect(doc()).toEqual(before);
    });

    it("moves only the sound, in one undo step", async () => {
      const { video, audio } = await pair();
      const before = doc();
      await run(kernel.bus.run(moveClip, { clipId: audio.id, start: 2 * S, soundOnly: true }));
      expect(doc().clips[video.id]!.start).toBe(0);
      expect(doc().clips[audio.id]!.start).toBe(2 * S);
      expect(doc().clips[audio.id]!.linkId).toBeUndefined();
      kernel.history.undo();
      expect(doc()).toEqual(before);
    });

    it("trims only the sound", async () => {
      const { video, audio } = await pair();
      await run(
        kernel.bus.run(trimClip, { clipId: audio.id, edge: "end", time: 4 * S, soundOnly: true }),
      );
      expect(doc().clips[audio.id]!.duration).toBe(4 * S);
      expect(doc().clips[video.id]!.duration).toBe(10 * S);
    });

    it("still moves both without it", async () => {
      const { video, audio } = await pair();
      await run(kernel.bus.run(moveClip, { clipId: audio.id, start: 2 * S }));
      expect(doc().clips[video.id]!.start).toBe(2 * S);
      expect(doc().clips[audio.id]!.linkId).toBe(doc().clips[video.id]!.linkId);
    });

    it("deletes the sound alone even when its picture is named too", async () => {
      const { video, audio } = await pair();
      await run(kernel.bus.run(deleteClips, { clipIds: [audio.id, video.id], soundOnly: true }));
      expect(doc().clips[video.id]).toBeDefined();
      expect(doc().clips[audio.id]).toBeUndefined();
    });

    it("refuses a picture, changing nothing", async () => {
      const { video } = await pair();
      const before = doc();
      for (const result of [
        await kernel.bus.run(deleteClips, { clipIds: [video.id], soundOnly: true }),
        await kernel.bus.run(moveClip, { clipId: video.id, start: S, soundOnly: true }),
        await kernel.bus.run(trimClip, { clipId: video.id, edge: "end", time: S, soundOnly: true }),
      ]) {
        expect(result).toMatchObject({ ok: false, error: { code: "timeline.not_sound" } });
      }
      expect(doc()).toBe(before);
    });

    it("leaves a sound that was never linked as it is", async () => {
      const sound = await place({ mediaId: "ma" });
      await run(kernel.bus.run(moveClip, { clipId: sound.id, start: S, soundOnly: true }));
      expect(doc().clips[sound.id]!.start).toBe(S);
    });
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

describe("image clips", () => {
  it("land at the file's default length, or the length asked for", async () => {
    expect((await place({ mediaId: "mi" })).duration).toBe(5 * S);
    expect((await place({ mediaId: "mi", start: 20 * S, duration: 9 * S })).duration).toBe(9 * S);
  });

  it("stretch past their default length and keep sourceIn 0", async () => {
    const { id } = await place({ mediaId: "mi" });
    await run(kernel.bus.run(trimClip, { clipId: id, edge: "end", time: 12 * S }));
    expect(doc().clips[id]).toMatchObject({ duration: 12 * S, sourceIn: 0 });
    await run(kernel.bus.run(trimClip, { clipId: id, edge: "start", time: 3 * S }));
    expect(doc().clips[id]).toMatchObject({ start: 3 * S, duration: 9 * S, sourceIn: 0 });
  });

  it("keep sourceIn 0 on both halves of a split", async () => {
    await place({ mediaId: "mi" });
    await run(kernel.bus.run(splitAt, { at: 2 * S }));
    expect(trackClips(doc(), doc().tracks[trackOfKind("video")]!).map((c) => c.sourceIn)).toEqual([
      0, 0,
    ]);
  });

  it("refuse an audio track and a sourceIn", async () => {
    const onAudio = await kernel.bus.run(addClip, { mediaId: "mi", trackId: trackOfKind("audio") });
    expect(onAudio).toMatchObject({ ok: false, error: { code: "timeline.kind_mismatch" } });
    const withSource = await kernel.bus.run(addClip, { mediaId: "mi", sourceIn: S });
    expect(withSource).toMatchObject({ ok: false, error: { code: "timeline.out_of_range" } });
  });
});

describe("splitting at a speed", () => {
  it("moves the right half's sourceIn by the offset times the rate", async () => {
    const clip = await place({ mediaId: "ma", duration: 4 * S });
    const speed = { rate: 2, pitchCorrection: true, reversed: false };
    kernel.modules.require(projectRef).store.api.setState((s) => ({
      clips: { ...s.clips, [clip.id]: { ...clip, speed } },
    }));
    const { created } = await run(kernel.bus.run(splitAt, { at: S, clipIds: [clip.id] }));
    expect(doc().clips[created[0]!]).toMatchObject({ sourceIn: 2 * S, speed });
    expect(doc().clips[clip.id]!.speed).toEqual(speed);
  });
});

describe("splitting a reversed clip", () => {
  it("gives the left half the later part of the file", async () => {
    const clip = await place({ mediaId: "ma", duration: 4 * S });
    const speed = { rate: 1, pitchCorrection: true, reversed: true };
    kernel.modules.require(projectRef).store.api.setState((s) => ({
      clips: { ...s.clips, [clip.id]: { ...clip, speed } },
    }));
    const { created } = await run(kernel.bus.run(splitAt, { at: S, clipIds: [clip.id] }));
    expect(doc().clips[clip.id]!.sourceIn).toBe(3 * S);
    expect(doc().clips[created[0]!]!.sourceIn).toBe(0);
  });
});

describe("ripple delete", () => {
  /** Sound-only clips on one track, as [start, duration] in seconds. */
  async function sounds(...spans: [number, number][]) {
    const clips = [];
    for (const [start, length] of spans) {
      clips.push(await place({ mediaId: "ma", start: start * S, duration: length * S }));
    }
    return clips;
  }
  const startOf = (id: string) => doc().clips[id]!.start / S;

  it("closes the clip's length", async () => {
    const [, b, c] = await sounds([0, 10], [10, 5], [15, 5]);
    await run(kernel.bus.run(rippleDelete, { clipIds: [b!.id] }));
    expect(startOf(c!.id)).toBe(10);
  });

  it("keeps gaps that were already there", async () => {
    const [, b, c] = await sounds([0, 5], [8, 2], [12, 2]);
    await run(kernel.bus.run(rippleDelete, { clipIds: [b!.id] }));
    expect(startOf(c!.id)).toBe(10);
  });

  it("adds up on a track", async () => {
    const [a, , c, d] = await sounds([0, 2], [2, 2], [4, 2], [6, 2]);
    await run(kernel.bus.run(rippleDelete, { clipIds: [a!.id, c!.id] }));
    expect(startOf(d!.id)).toBe(2);
  });

  it("moves a linked pair by the smaller shift and keeps it in sync", async () => {
    const image = await place({ mediaId: "mi", start: 0, duration: 4 * S });
    const [sound] = await sounds([0, 2]);
    const { video, audio } = await pair(4 * S);
    await run(kernel.bus.run(rippleDelete, { clipIds: [image.id, sound!.id] }));
    expect([startOf(video.id), startOf(audio.id)]).toEqual([2, 2]);
  });

  it("changes nothing when the shift would overlap", async () => {
    await place({ mediaId: "mi", start: 0, duration: 4 * S });
    const [sound] = await sounds([0, 4]);
    const { video } = await pair(4 * S);
    const before = doc();
    const result = await kernel.bus.run(rippleDelete, { clipIds: [sound!.id] });
    expect(result).toMatchObject({ ok: false, error: { code: "timeline.overlap" } });
    expect(doc()).toBe(before);
    expect(startOf(video.id)).toBe(4);
  });
});

describe("disabling clips", () => {
  it("marks linked partners, and stores nothing once enabled", async () => {
    const { video, audio } = await pair();
    await run(kernel.bus.run(setClipsDisabled, { clipIds: [video.id], disabled: true }));
    expect(doc().clips[audio.id]!.disabled).toBe(true);
    await run(kernel.bus.run(setClipsDisabled, { clipIds: [video.id], disabled: false }));
    expect(doc().clips[video.id]).not.toHaveProperty("disabled");
    expect(doc().clips[audio.id]).not.toHaveProperty("disabled");
  });
});

describe("linking clips", () => {
  it("restores an unlinked pair", async () => {
    const { video, audio } = await pair();
    await run(kernel.bus.run(unlinkClips, { clipIds: [video.id] }));
    await run(kernel.bus.run(linkClips, { clipIds: [video.id, audio.id] }));
    expect(partnersOf(doc(), video.id).map((c) => c.id)).toEqual([audio.id]);
  });

  it("refuses another file", async () => {
    const image = await place({ mediaId: "mi", duration: 4 * S });
    const sound = await place({ mediaId: "ma", duration: 4 * S });
    const result = await kernel.bus.run(linkClips, { clipIds: [image.id, sound.id] });
    expect(result).toMatchObject({ ok: false, error: { code: "timeline.link_mismatch" } });
  });

  it("refuses other timing", async () => {
    const { video, audio } = await pair();
    await run(kernel.bus.run(unlinkClips, { clipIds: [video.id] }));
    await run(kernel.bus.run(trimClip, { clipId: audio.id, edge: "end", time: 5 * S }));
    const result = await kernel.bus.run(linkClips, { clipIds: [video.id, audio.id] });
    expect(result).toMatchObject({ ok: false, error: { code: "timeline.link_mismatch" } });
  });
});

describe("keys on a sound-only page", () => {
  const pressed = (id: string) =>
    kernel.points
      .get(keybindings)
      .find((binding) => binding.id === id)
      ?.resolve();

  beforeEach(async () => {
    await kernel.modules.load(
      defineModule({
        ref: defineModuleRef<Record<string, never>>("test-sound-page"),
        name: "Sound page",
        tier: "feature",
        commands: [],
        mcpTools: [],
        setup({ contribute }) {
          contribute(appPages, {
            id: "test.sound",
            label: "Sound",
            icon: Volume2,
            keepsPlayback: true,
            timelineScope: "sound",
          });
          return { api: {} };
        },
      }),
    );
    const { audio } = await pair();
    kernel.modules.require(timelineRef).selectClip(audio.id);
  });

  it("Delete from a real selection deletes the sound alone, in one undo step", async () => {
    const before = doc();
    const { video, audio } = Object.fromEntries(
      Object.values(before.clips).map((c) => [
        before.tracks[c.trackId]!.kind === "audio" ? "audio" : "video",
        c,
      ]),
    ) as { video: Clip; audio: Clip };
    const timeline = kernel.modules.require(timelineRef);
    timeline.selectClip(audio.id);
    expect(timeline.view.getState().selection).toContain(video.id);
    await run(kernel.bus.run(showPage, { page: "test.sound" }));
    const action = pressed("timeline.delete")!;
    expect(await kernel.bus.execute(action.command, action.input)).toMatchObject({ ok: true });
    expect(doc().clips[video.id]).toBeDefined();
    expect(doc().clips[video.id]!.linkId).toBeUndefined();
    expect(doc().clips[audio.id]).toBeUndefined();
    kernel.history.undo();
    expect(doc()).toEqual(before);
  });

  it("Delete with a junction selected removes no junction on the sound page", async () => {
    kernel.modules.require(timelineRef).selectJunction("j1");
    expect(pressed("timeline.delete")).toMatchObject({ command: "junction.remove" });
    await run(kernel.bus.run(showPage, { page: "test.sound" }));
    expect(pressed("timeline.delete")).toBeNull();
  });
});
