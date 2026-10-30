import { z } from "zod";
import { CommandFailure, createId, defineCommand, LOCAL_ACTOR } from "@/core";
import { mediaRef } from "@/modules/media";
import {
  compositionContent,
  DEFAULT_FORMAT,
  frameDuration,
  placementsOf,
  projectRef,
  type Clip,
  type ProjectState,
  type TrackKind,
} from "@/modules/project";
import { addClip } from "@/modules/timeline";
import { checkFormat, formatInput, requireComposition } from "./composition.guards";
import { cloneComposition } from "./logic/clone";

const DEFAULT_DURATION = 10_000_000;
const DEFAULT_BACKGROUND = "#000000";

const duration = z.number().int().positive().describe("Microseconds");
const compositionId = z.string().describe("A composition's id, from project_get_state");

const settings = {
  name: z.string().min(1).max(120).optional(),
  format: formatInput.optional(),
  background: z.string().min(1).max(40).optional().describe("CSS colour, #000000 by default"),
  duration: duration.optional(),
  extendToFit: z.boolean().optional().describe("The length follows the end of the last clip"),
};

/** One empty track of a new composition. */
function emptyTrack(id: string, composition: string, kind: TrackKind, name: string) {
  return { id, compositionId: composition, kind, name, clipIds: [], muted: false, hidden: false };
}

/** Creates a composition with one video and one audio track. The first one becomes Main. */
export const createComposition = defineCommand({
  id: "composition.create",
  label: "New composition",
  description:
    "Creates a composition with one video track and one audio track, and opens it for you. Optional: name, format ({ width, height, fps }), background, duration (microseconds, 10 s by default) and extendToFit (the length follows the last clip). The first composition of a project becomes Main. Returns { compositionId }.",
  undoable: true,
  input: z.object(settings),
  run(ctx, input) {
    if (input.format) checkFormat(input.format);
    const { store, view } = ctx.require(projectRef);
    const id = createId("composition");
    const video = createId("track");
    const audio = createId("track");
    ctx.mutate(store, (draft) => {
      draft.compositions[id] = {
        id,
        name: input.name ?? `Composition ${draft.compositionOrder.length + 1}`,
        format: input.format ?? DEFAULT_FORMAT,
        background: input.background ?? DEFAULT_BACKGROUND,
        duration: input.duration ?? DEFAULT_DURATION,
        extendToFit: input.extendToFit ?? false,
        trackOrder: [video, audio],
      };
      draft.compositionOrder.push(id);
      draft.tracks[video] = emptyTrack(video, id, "video", "Video 1");
      draft.tracks[audio] = emptyTrack(audio, id, "audio", "Audio 1");
      draft.mainCompositionId ??= id;
    });
    view.setOpen(ctx.actor, id);
    // Someone with nothing open should see what an agent just started.
    if (view.openFor(LOCAL_ACTOR) === null) view.setOpen(LOCAL_ACTOR, id);
    return { compositionId: id };
  },
});

/** Starts a composition from files: their size, frame rate and length, and the files on it. */
export const createFromMedia = defineCommand({
  id: "composition.createFromMedia",
  label: "New composition",
  description:
    "Creates a composition from imported files, in one undo step: named after the first file with a picture, at its size and frame rate, with Extend to fit on and the files placed one after another from 0. Fails with media.not_ready while a file is still being read, and with composition.no_picture when none has a picture. Returns { compositionId, clips }.",
  undoable: true,
  input: z.object({ mediaIds: z.array(z.string()).min(1) }),
  async run(ctx, { mediaIds }) {
    const { store } = ctx.require(projectRef);
    const media = ctx.require(mediaRef);
    const { media: files } = store.getState();
    for (const id of mediaIds) {
      const file = files[id];
      if (!file) throw new CommandFailure("media.not_found", `No media with id "${id}"`);
      if (file.kind === "video" && !media.pictureMeta(id)) {
        throw new CommandFailure("media.not_ready", `${file.name} is still being read.`);
      }
    }
    const first = mediaIds.find((id) => files[id]!.kind === "video");
    if (first === undefined) {
      throw new CommandFailure(
        "composition.no_picture",
        "These files have no picture to take a size from. Create the composition with a size instead.",
      );
    }
    const { width, height, fps, duration: length } = media.pictureMeta(first)!;
    const { compositionId: id } = await ctx.execute(createComposition, {
      name: files[first]!.name.replace(/\.[^.]+$/, ""),
      format: { width, height, fps },
      duration: length,
      extendToFit: true,
    });
    const clips: Clip[] = [];
    let start = 0;
    for (const mediaId of mediaIds) {
      const added = await ctx.execute(addClip, { mediaId, start });
      clips.push(...added.clips);
      start += added.clips[0]!.duration;
    }
    return { compositionId: id, clips };
  },
});

/** Changes a composition's name, format, background or length. */
export const setSettings = defineCommand({
  id: "composition.setSettings",
  label: "Composition settings",
  description:
    "Changes a composition's settings: name, format ({ width, height, fps }), background, duration (microseconds) and extendToFit. A duration without extendToFit turns Extend to fit off, so the length you set holds. Clips keep their positions in the frame. Returns the composition.",
  undoable: true,
  input: z.object({ compositionId, ...settings }),
  run(ctx, { compositionId: id, ...input }) {
    const { store } = ctx.require(projectRef);
    requireComposition(store.getState(), id);
    if (input.format) checkFormat(input.format);
    ctx.mutate(store, (draft) => {
      const composition = draft.compositions[id]!;
      if (input.name !== undefined) composition.name = input.name;
      if (input.format !== undefined) composition.format = input.format;
      if (input.background !== undefined) composition.background = input.background;
      if (input.duration !== undefined) {
        composition.duration = input.duration;
        composition.extendToFit = false;
      }
      if (input.extendToFit !== undefined) composition.extendToFit = input.extendToFit;
    });
    return store.getState().compositions[id];
  },
});

/** Makes a composition the one that opens first and is exported later. */
export const setMain = defineCommand({
  id: "composition.setMain",
  label: "Set as Main",
  description:
    "Makes a composition Main: the one that opens with the project and is exported later.",
  undoable: true,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store } = ctx.require(projectRef);
    requireComposition(store.getState(), id);
    ctx.mutate(store, (draft) => {
      draft.mainCompositionId = id;
    });
  },
});

/** The next free "<name> copy" name. */
export function copyName(state: ProjectState, name: string): string {
  const taken = new Set(Object.values(state.compositions).map((c) => c.name));
  const first = `${name} copy`;
  if (!taken.has(first)) return first;
  let n = 2;
  while (taken.has(`${first} ${n}`)) n++;
  return `${first} ${n}`;
}

/** Copies a composition. Compositions placed inside it stay shared. */
export const duplicateComposition = defineCommand({
  id: "composition.duplicate",
  label: "Duplicate composition",
  description:
    "Copies a composition with its tracks, clips and transitions. Compositions placed inside it stay shared with the original. Returns { compositionId }.",
  undoable: true,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const { name } = requireComposition(state, id);
    let copy = "";
    ctx.mutate(store, (draft) => {
      copy = cloneComposition(draft, id, copyName(state, name));
    });
    return { compositionId: copy };
  },
});

/** Deletes a composition and everything on its timeline. */
export const deleteComposition = defineCommand({
  id: "composition.delete",
  label: "Delete composition",
  description:
    "Deletes a composition with its tracks, clips and transitions. Fails with composition.in_use while it is placed in another composition, and with composition.main while it is Main and others exist: move Main first.",
  undoable: true,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const composition = requireComposition(state, id);
    if (placementsOf(state, id).some((clip) => !composition.trackOrder.includes(clip.trackId))) {
      throw new CommandFailure(
        "composition.in_use",
        `"${composition.name}" is placed in another composition. Delete those clips first.`,
      );
    }
    const others = state.compositionOrder.filter((other) => other !== id);
    if (state.mainCompositionId === id && others.length > 0) {
      throw new CommandFailure(
        "composition.main",
        `"${composition.name}" is Main. Set another composition as Main first.`,
      );
    }
    ctx.mutate(store, (draft) => {
      const tracks = new Set(composition.trackOrder);
      for (const clip of Object.values(draft.clips)) {
        if (tracks.has(clip.trackId)) delete draft.clips[clip.id];
      }
      for (const junction of Object.values(draft.junctions)) {
        if (tracks.has(junction.trackId)) delete draft.junctions[junction.id];
      }
      for (const trackId of tracks) delete draft.tracks[trackId];
      delete draft.compositions[id];
      draft.compositionOrder = others;
      if (draft.mainCompositionId === id) draft.mainCompositionId = null;
    });
  },
});

/** Sets a composition's length to the end of its last clip, once. */
export const extendToFitOnce = defineCommand({
  id: "composition.extendToFit",
  label: "Extend to fit",
  description:
    "Sets a composition's length to the end of its last clip, once. It stays a fixed length afterwards.",
  undoable: true,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store } = ctx.require(projectRef);
    const { format } = requireComposition(store.getState(), id);
    const end = Math.max(compositionContent(store.getState(), id), frameDuration(format));
    ctx.mutate(store, (draft) => {
      draft.compositions[id]!.duration = end;
    });
  },
});

/** Opens a composition. Yours only: an agent never moves the user. */
export const openComposition = defineCommand({
  id: "composition.open",
  label: "Open composition",
  description:
    "Opens a composition for you: your playhead, timeline commands without a track, and captured frames then work in it. The user's view doesn't move.",
  undoable: false,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    const { store, view } = ctx.require(projectRef);
    requireComposition(store.getState(), id);
    view.setOpen(ctx.actor, id);
  },
});

/** Closes a tab above the timeline. Nothing is lost: the composition stays in the Library. */
export const closeTab = defineCommand({
  id: "composition.closeTab",
  label: "Close tab",
  description: "Closes a composition's tab above the timeline. It stays in the Library.",
  undoable: false,
  input: z.object({ compositionId }),
  run(ctx, { compositionId: id }) {
    ctx.require(projectRef).view.closeTab(id);
  },
});

export const compositionCommands = [
  createComposition,
  createFromMedia,
  setSettings,
  setMain,
  duplicateComposition,
  deleteComposition,
  extendToFitOnce,
  openComposition,
  closeTab,
];
