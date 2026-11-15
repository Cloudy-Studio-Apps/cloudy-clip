import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { compositionClips, projectRef, type Clip } from "@/modules/project";
import { targetComposition } from "./sound.mix.write";
import { soundRef } from "./sound.ref";

/** Finds the beats in the files of clips with sound, in the background, for ticks and snapping. */
export const findBeats = defineCommand({
  id: "sound.findBeats",
  label: "Find beats",
  description:
    "Finds the beats in the files of clipIds (clips on audio tracks; others are skipped), or of every clip on an audio track of your open composition (or compositionId) when clipIds is missing. It runs in the background and returns at once ({ started: true, files }); { started: false, running: true } when a find already runs. Beats are kept per file outside the document (not undoable, nothing is placed): the timeline draws them as ticks in the ruler and drags snap to them; sound_get_beats reads them. A file with no tempo (speech, a held tone) has none. Fails with sound.clip_not_found, sound.no_sound_clips, composition.not_found.",
  undoable: false,
  input: z.object({
    clipIds: z.array(z.string()).optional(),
    compositionId: z.string().optional(),
  }),
  run(ctx, { clipIds, compositionId }) {
    const state = ctx.require(projectRef).store.getState();
    let clips: Clip[];
    if (clipIds) {
      clips = clipIds.map((id) => {
        const clip = state.clips[id];
        if (!clip) throw new CommandFailure("sound.clip_not_found", `No clip ${id}.`);
        return clip;
      });
    } else {
      clips = compositionClips(state, targetComposition(ctx, compositionId));
    }
    const paths = new Set<string>();
    for (const clip of clips) {
      const media = clip.mediaId === undefined ? undefined : state.media[clip.mediaId];
      if (media && media.kind !== "image" && state.tracks[clip.trackId]?.kind === "audio") {
        paths.add(media.path);
      }
    }
    if (paths.size === 0) {
      throw new CommandFailure(
        "sound.no_sound_clips",
        "There is no clip with sound to find beats in: select one on an audio track.",
      );
    }
    if (!ctx.require(soundRef).beats.find([...paths])) return { started: false, running: true };
    return { started: true, files: paths.size };
  },
});

/** Stops finding beats; files done so far keep theirs. */
export const cancelBeats = defineCommand({
  id: "sound.cancelBeats",
  label: "Cancel finding beats",
  description:
    "Stops the find of sound.findBeats, if one runs. Files already done keep their beats.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    ctx.require(soundRef).beats.cancel();
  },
});

/** The beat commands, for the module. */
export const soundBeatCommands = [findBeats, cancelBeats];
