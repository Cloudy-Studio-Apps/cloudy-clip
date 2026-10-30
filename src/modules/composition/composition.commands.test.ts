import { beforeEach, describe, expect, it } from "vitest";
import { createKernel, LOCAL_ACTOR, type CommandDefinition, type Kernel } from "@/core";
import { elementModule } from "@/modules/element";
import { createFakeMediaModule, removeMedia } from "@/modules/media";
import {
  createProjectModule,
  orderedTracks,
  projectRef,
  type Clip,
  type ProjectState,
} from "@/modules/project";
import {
  createComposition,
  deleteComposition,
  duplicateComposition,
  extendToFitOnce,
  setMain,
  setSettings,
} from "./composition.commands";
import { compositionModule } from "./composition.module";

const S = 1_000_000;
const AGENT = "agent-1";
let kernel: Kernel;

const project = () => kernel.modules.require(projectRef);
const state = () => project().store.getState();
const view = () => project().view;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function ok(command: CommandDefinition<any, any>, input: unknown, actor?: string) {
  const result = await kernel.bus.run(command, input as never, actor ? { actor } : {});
  if (!result.ok) throw new Error(`command failed: ${result.error.code}`);
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
    junctions: {},
  };
  await kernel.modules.loadAll([
    createProjectModule(empty),
    elementModule,
    createFakeMediaModule({ m: { status: "ready", duration: 10 * S, width: 8, height: 8 } }),
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

  it("opens an agent's composition for the user only when the user has nothing open", async () => {
    view().setOpen(LOCAL_ACTOR, null);
    const first = await ok(createComposition, {}, AGENT);
    expect(view().openFor(LOCAL_ACTOR)).toBe(first.compositionId);
    const second = await ok(createComposition, {}, AGENT);
    expect(view().openFor(LOCAL_ACTOR)).toBe(first.compositionId);
    expect(view().openFor(AGENT)).toBe(second.compositionId);
  });

  it("moves an actor off a composition an undo removes", async () => {
    const main = await ok(createComposition, {});
    const other = await ok(createComposition, {});
    expect(view().openFor(LOCAL_ACTOR)).toBe(other.compositionId);
    kernel.history.undo(LOCAL_ACTOR);
    expect(state().compositions[other.compositionId]).toBeUndefined();
    expect(view().openFor(LOCAL_ACTOR)).toBe(main.compositionId);
  });

  it("lands on nothing when the last composition is undone", async () => {
    await ok(createComposition, {});
    kernel.history.undo(LOCAL_ACTOR);
    expect(view().openFor(LOCAL_ACTOR)).toBeNull();
    expect(() => view().requireOpen(LOCAL_ACTOR)).toThrow(/create one first/i);
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

  it("moves Main with the star", async () => {
    await ok(createComposition, {});
    const other = await ok(createComposition, {});
    await ok(setMain, other);
    expect(state().mainCompositionId).toBe(other.compositionId);
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

  it("rejects a size outside 2 to 8192", async () => {
    const { compositionId } = await ok(createComposition, {});
    const format = { width: 1, height: 10, fps: 30 };
    expect(await failure(setSettings, { compositionId, format })).toBe("composition.invalid_size");
  });

  it("a set length turns Extend to fit off", async () => {
    const { compositionId } = await ok(createComposition, { extendToFit: true });
    await ok(setSettings, { compositionId, duration: 4 * S });
    expect(state().compositions[compositionId]).toMatchObject({
      duration: 4 * S,
      extendToFit: false,
    });
  });

  it("fits once without turning Extend to fit on", async () => {
    const { compositionId } = await ok(createComposition, {});
    addTo(compositionId, text("t", "", 0, { duration: 3 * S }));
    await ok(extendToFitOnce, { compositionId });
    expect(state().compositions[compositionId]).toMatchObject({
      duration: 3 * S,
      extendToFit: false,
    });
  });
});
