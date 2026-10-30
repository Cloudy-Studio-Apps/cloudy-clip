import { z } from "zod";
import { CommandFailure, createId, defineCommand, LOCAL_ACTOR } from "@/core";
import { mediaRef } from "@/modules/media";
import { DEFAULT_FORMAT, projectRef, type Clip, type TrackKind } from "@/modules/project";
import { addClip } from "@/modules/timeline";
import { checkFormat, checkLength, settings } from "./composition.guards";

const DEFAULT_DURATION = 10_000_000;
const DEFAULT_BACKGROUND = "#000000";

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
    checkLength(input.duration ?? DEFAULT_DURATION, input.format ?? DEFAULT_FORMAT);
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
      if (file.kind !== "audio" && !media.pictureMeta(id)) {
        throw new CommandFailure("media.not_ready", `${file.name} is still being read.`);
      }
    }
    const first = mediaIds.find((id) => files[id]!.kind !== "audio");
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
