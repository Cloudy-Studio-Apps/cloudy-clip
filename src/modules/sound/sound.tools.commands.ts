import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { clipEnd, formatOf, projectRef } from "@/modules/project";
import {
  deleteClips,
  editSoundOnly,
  minClipDuration,
  rippleDelete,
  splitAt,
} from "@/modules/timeline";
import { SILENCE_DEFAULTS } from "./logic/silence";
import { soundRef } from "./sound.ref";

/**
 * Cuts the silent stretches out of clips with sound. On the Sound page (`soundOnly`) it cuts sound
 * alone and leaves gaps; on a video it is a jump cut that closes them.
 */
export const stripSilence = defineCommand({
  id: "sound.stripSilence",
  label: "Strip silence",
  description:
    "Cuts the silent stretches out of clips with sound, as one undo step. Silence is FFmpeg's silencedetect over the part of the file each clip plays: quieter than thresholdDb (default -35 dBFS) for at least minMs (default 400); padMs (default 100) of quiet stays on each side of a cut. Read what it would cut first with sound_find_silences. A linked picture and sound are cut together (a jump cut). With soundOnly, only clips on audio tracks are cut (linked ones unlinked first, as sound editing does) and the gaps stay, so the pictures are untouched; closeGaps is refused with it. With closeGaps, what follows each cut on its tracks (and its linked clips) moves earlier by the removed time, and tracks that hold nothing of these clips do not move, so they drift against them: check the tracks first. Clips with no sound file of their own (text, images, held frames) are skipped. Returns { cuts, removed } (microseconds taken out). Fails with sound.no_silence when nothing is found (nothing changes), sound.silence_failed when the file can't be read, sound.clip_not_found, sound.close_gaps_sound_only, timeline.not_sound, junction.split_in_overlap.",
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string()).min(1),
    thresholdDb: z.number().min(-90).max(0).default(SILENCE_DEFAULTS.thresholdDb),
    minMs: z.number().min(10).max(60_000).default(SILENCE_DEFAULTS.minMs),
    padMs: z.number().min(0).max(5_000).default(SILENCE_DEFAULTS.padMs),
    closeGaps: z.boolean().default(false),
    soundOnly: z.boolean().optional(),
  }),
  async run(ctx, { clipIds, closeGaps, soundOnly, ...params }) {
    const project = ctx.require(projectRef).store;
    for (const id of clipIds) {
      if (!project.getState().clips[id]) {
        throw new CommandFailure("sound.clip_not_found", `No clip ${id}.`);
      }
    }
    if (soundOnly && closeGaps) {
      throw new CommandFailure(
        "sound.close_gaps_sound_only",
        "Closing gaps would move the sound against its picture: strip sound alone leaves gaps. Cut both on the Edit page instead.",
      );
    }
    const { silences } = ctx.require(soundRef);
    try {
      return await editSoundOnly(ctx, clipIds, soundOnly, async (ids) => {
        let found;
        try {
          found = await silences.cutsOf(ids, params);
        } catch (error) {
          const message =
            typeof error === "object" && error !== null && "message" in error
              ? String(error.message)
              : String(error);
          throw new CommandFailure(
            "sound.silence_failed",
            `Could not look for silence: ${message}`,
          );
        }
        // Latest first: a cut never moves what is cut before it, even when it closes its gap.
        const cuts = found
          .flatMap(({ clipId, cuts }) => cuts.map((cut) => ({ clipId, ...cut })))
          .sort((a, b) => b.start - a.start);
        if (cuts.length === 0) {
          throw new CommandFailure(
            "sound.no_silence",
            "No silence found at this threshold: raise it, or shorten the minimum.",
          );
        }
        let removed = 0;
        let count = 0;
        for (const cut of cuts) {
          const state = project.getState();
          const clip = state.clips[cut.clipId]!;
          const least = minClipDuration(formatOf(state, clip));
          // A cut that leaves less than a frame at an edge takes the edge.
          const start = cut.start - clip.start < least ? clip.start : cut.start;
          const end = clipEnd(clip) - cut.end < least ? clipEnd(clip) : cut.end;
          if (end - start < least) continue;
          if (end < clipEnd(clip)) await ctx.execute(splitAt, { at: end, clipIds: [clip.id] });
          let middle = clip.id;
          if (start > clip.start) {
            const { created } = await ctx.execute(splitAt, { at: start, clipIds: [clip.id] });
            const now = project.getState();
            middle = created.find((id) => now.clips[id]?.trackId === clip.trackId) ?? middle;
          }
          await ctx.execute(closeGaps ? rippleDelete : deleteClips, { clipIds: [middle] });
          removed += end - start;
          count += 1;
        }
        if (count === 0) {
          throw new CommandFailure("sound.no_silence", "The silences found are under a frame.");
        }
        return { cuts: count, removed };
      });
    } finally {
      silences.forget();
    }
  },
});

/** The tools commands, for the module. */
export const soundToolsCommands = [stripSilence];
