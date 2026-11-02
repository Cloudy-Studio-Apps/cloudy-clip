import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, LOCAL_ACTOR, type CommandDefinition, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { createFakeFontsModule } from "@/modules/fonts";
import { junctionModule } from "@/modules/junction";
import { createFakeMediaModule, mediaRef, removeMedia, type MediaProbe } from "@/modules/media";
import { previewModule } from "@/modules/preview";
import {
  createProjectModule,
  orderedTracks,
  placementsOf,
  projectRef,
  type Clip,
  type ProjectState,
} from "@/modules/project";
import { splitAt, timelineModule, trimClip } from "@/modules/timeline";
import {
  createComposition,
  createFromMedia,
  deleteComposition,
  duplicateComposition,
  setMain,
  setSettings,
} from "./composition.commands";
import { compositionModule } from "./composition.module";
import { placeComposition } from "./composition.place.command";
import { makeUnique } from "./composition.unique.command";
import { groupClips } from "./composition.group.command";

const S = 1_000_000;
let kernel: Kernel;

const project = () => kernel.modules.require(projectRef);
const state = () => project().store.getState();
const view = () => project().view;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function ok(command: CommandDefinition<any, any>, input: unknown, actor?: string) {
  const result = await kernel.bus.run(command, input as never, actor ? { actor } : {});
  if (!result.ok) throw new Error(`command failed: ${result.error.code} ${result.error.message}`);
  return result.value as { compositionId: string };
}

async function failure(command: CommandDefinition<any, any>, input: unknown) {
  const result = await kernel.bus.run(command, input as never);
  return result.ok ? null : result.error.code;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function write(recipe: (draft: ProjectState) => void) {
  const store = project().store as unknown as { produce(r: (d: ProjectState) => void): unknown };
  store.produce(recipe);
}

function text(id: string, trackId: string, start: number, extra: Partial<Clip> = {}): Clip {
  return { id, kind: "text", trackId, start, sourceIn: 0, duration: S, props: {}, ...extra };
}

/** A clip on the composition's first track. */
function addTo(compositionId: string, clip: Omit<Clip, "trackId">) {
  write((draft) => {
    const trackId = draft.compositions[compositionId]!.trackOrder[0]!;
    draft.clips[clip.id] = { ...clip, trackId };
    draft.tracks[trackId]!.clipIds.push(clip.id);
  });
}

beforeEach(async () => {
  kernel = await createKernel();
  const empty: ProjectState = {
    compositions: {},
    compositionOrder: [],
    mainCompositionId: null,
    media: { m: { id: "m", name: "a.mp4", path: "/a.mp4", kind: "video", size: 1 } },
    mediaOrder: ["m"],
    tracks: {},
    clips: {},
    bins: {},
    binOrder: [],
    solids: {},
    solidOrder: [],
    junctions: {},
  };
  await kernel.modules.loadAll([
    createProjectModule(empty),
    elementModule,
    junctionModule,
    createFakeMediaModule({ m: { status: "ready", duration: 10 * S, width: 8, height: 8 } }),
    createFakeFontsModule(),
    previewModule,
    timelineModule,
    compositionModule,
  ]);
});

describe("composition commands", () => {
  it("makes the first composition Main, with a video and an audio track, and opens it", async () => {
    const { compositionId } = await ok(createComposition, {});
    expect(state().mainCompositionId).toBe(compositionId);
    expect(orderedTracks(state(), compositionId).map((t) => t.kind)).toEqual(["video", "audio"]);
    expect(view().openFor(LOCAL_ACTOR)).toBe(compositionId);
  });

  it("moves an actor off a composition an undo removes", async () => {
    const main = await ok(createComposition, {});
    const other = await ok(createComposition, {});
    expect(view().openFor(LOCAL_ACTOR)).toBe(other.compositionId);
    kernel.history.undo(LOCAL_ACTOR);
    expect(state().compositions[other.compositionId]).toBeUndefined();
    expect(view().openFor(LOCAL_ACTOR)).toBe(main.compositionId);
  });

  it("refuses to delete Main while others exist, and empties the project with the last", async () => {
    const main = await ok(createComposition, {});
    const other = await ok(createComposition, {});
    expect(await failure(deleteComposition, main)).toBe("composition.main");
    await ok(deleteComposition, other);
    await ok(deleteComposition, main);
    expect(state().mainCompositionId).toBeNull();
    expect(state().tracks).toEqual({});
  });

  it("frees media with the composition that used it", async () => {
    const { compositionId } = await ok(createComposition, {});
    await ok(createComposition, {});
    addTo(compositionId, {
      id: "v",
      kind: "media",
      mediaId: "m",
      start: 0,
      sourceIn: 0,
      duration: S,
      props: {},
    });
    expect(await failure(removeMedia, { mediaId: "m" })).toBe("media.in_use");
    await ok(setMain, { compositionId: state().compositionOrder[1]! });
    await ok(deleteComposition, { compositionId });
    expect(await failure(removeMedia, { mediaId: "m" })).toBeNull();
  });

  it("refuses to delete a composition placed elsewhere", async () => {
    const inner = await ok(createComposition, {});
    const outer = await ok(createComposition, {});
    await ok(setMain, outer);
    addTo(outer.compositionId, {
      ...text("p", "", 0),
      kind: "composition",
      compositionRef: inner.compositionId,
    });
    expect(await failure(deleteComposition, inner)).toBe("composition.in_use");
  });

  it("duplicates tracks, clips, links and junctions under new ids", async () => {
    const { compositionId } = await ok(createComposition, { name: "Intro" });
    const [v, a] = state().compositions[compositionId]!.trackOrder as [string, string];
    write((draft) => {
      draft.clips.l = text("l", v, 0);
      draft.clips.r = text("r", v, S);
      draft.clips.s = text("s", a, 0, { linkId: "k" });
      draft.clips.l.linkId = "k";
      draft.tracks[v]!.clipIds = ["l", "r"];
      draft.tracks[a]!.clipIds = ["s"];
      draft.junctions.j = {
        id: "j",
        kind: "cut",
        trackId: v,
        leftClipId: "l",
        rightClipId: "r",
        duration: 0,
        props: {},
      };
    });
    const copy = await ok(duplicateComposition, { compositionId });
    expect(state().compositions[copy.compositionId]!.name).toBe("Intro copy");
    const [cv, ca] = state().compositions[copy.compositionId]!.trackOrder as [string, string];
    const [cl, cr] = state().tracks[cv]!.clipIds as [string, string];
    const cs = state().tracks[ca]!.clipIds[0]!;
    expect(cl).not.toBe("l");
    expect(state().clips[cl]!.trackId).toBe(cv);
    expect(state().clips[cl]!.linkId).toBe(state().clips[cs]!.linkId);
    expect(state().clips[cl]!.linkId).not.toBe("k");
    const junction = Object.values(state().junctions).find((j) => j.trackId === cv)!;
    expect([junction.leftClipId, junction.rightClipId]).toEqual([cl, cr]);
  });

  describe("the automatic start", () => {
    const ready = (media: Record<string, MediaProbe>) =>
      kernel.modules.require(mediaRef).probes.setState({ probes: media });
    const addFile = (id: string, name: string, kind: "video" | "audio" | "image") =>
      write((draft) => {
        draft.media[id] = { id, name, path: `/${name}`, kind, size: 1 };
        draft.mediaOrder.push(id);
      });
    const meta = { width: 3840, height: 2160, fps: 30_000 / 1001, duration: 12 * S };

    beforeEach(() => {
      addFile("v", "beach.mp4", "video");
      addFile("a", "song.wav", "audio");
      ready({
        v: { status: "pending", proxy: { state: "encoding", hasAudio: true, meta } },
        a: { status: "ready", duration: 5 * S },
        p: { status: "pending" },
      });
    });

    it("takes a size from an animated image, not the rate of its frames", async () => {
      addFile("g", "loop.gif", "image");
      ready({
        g: {
          status: "ready",
          duration: S,
          width: 160,
          height: 120,
          proxy: {
            state: "ready",
            meta: { width: 160, height: 120, fps: 10, duration: S, frames: 10 },
          },
        },
      });
      const { compositionId } = await ok(createFromMedia, { mediaIds: ["g"] });
      expect(state().compositions[compositionId]!.format).toMatchObject({ fps: 30 });
    });

    it("makes a composition matching the file, in one undo step", async () => {
      const { compositionId } = await ok(createFromMedia, { mediaIds: ["v"] });
      expect(state().compositions[compositionId]).toMatchObject({
        name: "beach",
        format: { width: 3840, height: 2160, fps: 30_000 / 1001 },
        extendToFit: true,
        duration: 12 * S,
      });
      expect(state().mainCompositionId).toBe(compositionId);
      kernel.history.undo(LOCAL_ACTOR);
      expect(state().compositions).toEqual({});
      expect(state().clips).toEqual({});
    });
  });

  describe("placing", () => {
    it("refuses a cycle, direct and through another composition", async () => {
      const a = await ok(createComposition, {});
      const outer = await ok(createComposition, {});
      view().setOpen(LOCAL_ACTOR, outer.compositionId);
      await ok(placeComposition, a);
      view().setOpen(LOCAL_ACTOR, a.compositionId);
      expect(await failure(placeComposition, a)).toBe("composition.cycle");
      expect(await failure(placeComposition, outer)).toBe("composition.cycle");
    });

    it("places a picture and a linked sound clip, even for a silent composition", async () => {
      const intro = await ok(createComposition, { duration: 5 * S });
      const main = await ok(createComposition, {});
      const { clips } = (await ok(placeComposition, intro)) as unknown as { clips: string[] };
      expect(clips).toHaveLength(2);
      const [picture, sound] = clips.map((id) => state().clips[id]!);
      expect(picture).toMatchObject({ kind: "composition", duration: 5 * S });
      expect(sound!.linkId).toBe(picture!.linkId);
      expect(sound!.compositionRef).toBe(intro.compositionId);
      expect(state().tracks[sound!.trackId]!.kind).toBe("audio");
      expect(state().tracks[picture!.trackId]!.compositionId).toBe(main.compositionId);
    });

    it("limits a placement's trim to the composition's length", async () => {
      const intro = await ok(createComposition, { duration: 5 * S });
      await ok(createComposition, {});
      const { clips } = (await ok(placeComposition, intro)) as unknown as { clips: string[] };
      await kernel.bus.run(trimClip, { clipId: clips[0]!, edge: "end", time: 9 * S });
      expect(state().clips[clips[0]!]!.duration).toBe(5 * S);
    });

    it("splits a placement keeping both halves on the same composition, with an Extend to fit home", async () => {
      const intro = await ok(createComposition, { duration: 5 * S });
      await ok(createComposition, { extendToFit: true });
      await ok(placeComposition, intro);
      await ok(splitAt, { at: 2 * S });
      const pictures = Object.values(state().clips).filter((c) => c.compositionRef);
      expect(pictures).toHaveLength(4);
      expect(pictures.map((c) => c.sourceIn).sort((a, b) => a - b)).toEqual([0, 0, 2 * S, 2 * S]);
    });
  });

  describe("making a placement unique", () => {
    /** `main` plays `intro` twice, and `intro` plays `logo`. */
    async function nested() {
      const logo = await ok(createComposition, { name: "Logo" });
      const intro = await ok(createComposition, { name: "Intro" });
      await ok(placeComposition, logo);
      await ok(createComposition, { name: "Main" });
      const first = (await ok(placeComposition, intro)) as unknown as { clips: string[] };
      const second = (await ok(placeComposition, intro)) as unknown as { clips: string[] };
      return { logo, intro, first: first.clips, second: second.clips };
    }

    it("points one placement and its sound at a copy, leaving the others", async () => {
      const { intro, first, second } = await nested();
      const { compositionId } = await ok(makeUnique, { clipId: first[0] });
      expect(state().clips[first[0]!]!.compositionRef).toBe(compositionId);
      expect(state().clips[first[1]!]!.compositionRef).toBe(compositionId);
      expect(state().clips[second[0]!]!.compositionRef).toBe(intro.compositionId);
      expect(state().compositions[compositionId]!.name).toBe("Intro copy");
    });

    it("keeps inner compositions shared", async () => {
      const { logo, first } = await nested();
      await ok(makeUnique, { clipId: first[0] });
      expect(placementsOf(state(), logo.compositionId)).toHaveLength(4);
    });

    it("undoes in one step", async () => {
      const { intro, first } = await nested();
      const before = Object.keys(state().compositions).length;
      await ok(makeUnique, { clipId: first[0] });
      kernel.history.undo(LOCAL_ACTOR);
      expect(state().clips[first[0]!]!.compositionRef).toBe(intro.compositionId);
      expect(Object.keys(state().compositions)).toHaveLength(before);
    });
  });

  describe("grouping", () => {
    async function twoClips() {
      const { compositionId } = await ok(createComposition, {});
      const [v] = state().compositions[compositionId]!.trackOrder as [string, string];
      write((draft) => {
        draft.clips.a = text("a", v, 2 * S, { duration: 2 * S });
        draft.clips.b = text("b", v, 6 * S, { duration: 2 * S });
        draft.tracks[v]!.clipIds = ["a", "b"];
      });
      return { compositionId, v };
    }

    it("groups in one undo step, with Extend to fit off and times from 0", async () => {
      const { v } = await twoClips();
      const { compositionId } = await ok(groupClips, { clipIds: ["a", "b"] });
      expect(state().compositions[compositionId]).toMatchObject({
        extendToFit: false,
        duration: 6 * S,
      });
      expect(state().clips.a!.start).toBe(0);
      expect(state().clips.b!.start).toBe(4 * S);
      const placed = placementsOf(state(), compositionId);
      expect(placed).toHaveLength(2);
      expect(placed.find((c) => c.trackId === v)).toMatchObject({ start: 2 * S, duration: 6 * S });
      kernel.history.undo(LOCAL_ACTOR);
      expect(state().clips.a!.start).toBe(2 * S);
      expect(state().tracks[v]!.clipIds).toEqual(["a", "b"]);
    });

    it("refuses with composition.group_blocked, changing nothing", async () => {
      const { v } = await twoClips();
      write((draft) => {
        draft.clips.c = text("c", v, 4.5 * S);
        draft.tracks[v]!.clipIds = ["a", "c", "b"];
      });
      const before = state();
      expect(await failure(groupClips, { clipIds: ["a", "b"] })).toBe("composition.group_blocked");
      expect(state()).toBe(before);
    });
  });

  it("scales what sits in a composition when asked, in one step with the size", async () => {
    const { compositionId } = await ok(createComposition, {
      format: { width: 1080, height: 1920, fps: 30 },
    });
    addTo(compositionId, {
      ...text("t", "", 0, { transform: { x: 0, y: 600, scale: 1, rotation: 0 } }),
      kind: "media",
    });
    await ok(setSettings, {
      compositionId,
      format: { width: 1920, height: 1080, fps: 30 },
      resize: "scale",
    });
    expect(state().clips.t!.transform!.y).toBeCloseTo(600 * (1080 / 1920));
    kernel.history.undo(LOCAL_ACTOR);
    expect(state().clips.t!.transform!.y).toBe(600);
    expect(state().compositions[compositionId]!.format.width).toBe(1080);
  });

  it("refuses a length under one frame, which would shrink every placement to nothing", async () => {
    const { compositionId } = await ok(createComposition, {});
    expect(await failure(setSettings, { compositionId, duration: 1 })).toBe(
      "composition.too_short",
    );
    expect(await failure(createComposition, { duration: 1 })).toBe("composition.too_short");
  });

  it("groups a clip with a transition at the edge, and ends the neighbour there", async () => {
    const { compositionId } = await ok(createComposition, {});
    const [v] = state().compositions[compositionId]!.trackOrder as [string, string];
    write((draft) => {
      draft.clips.l = text("l", v, 0, { duration: 3 * S });
      draft.clips.m = text("m", v, 2 * S, { duration: 3 * S, kind: "media", mediaId: "m" });
      draft.clips.r = text("r", v, 4 * S, { duration: 3 * S, kind: "media", mediaId: "m" });
      draft.tracks[v]!.clipIds = ["l", "m", "r"];
      const junction = { kind: "cut", trackId: v, duration: S, props: {} };
      draft.junctions.a = { ...junction, id: "a", leftClipId: "l", rightClipId: "m" };
      draft.junctions.b = { ...junction, id: "b", leftClipId: "m", rightClipId: "r" };
    });
    const { compositionId: grouped } = await ok(groupClips, { clipIds: ["m"] });
    expect(state().junctions).toEqual({});
    expect(state().clips.l!.duration).toBe(2 * S);
    expect(state().clips.r).toMatchObject({ start: 5 * S, sourceIn: S, duration: 2 * S });
    const [picture] = placementsOf(state(), grouped);
    expect(picture).toMatchObject({ start: 2 * S, duration: 3 * S });
  });
});
