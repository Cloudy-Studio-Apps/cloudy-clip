import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { setSound } from "@/modules/audio";
import { setKeyValues } from "@/modules/keyframe";
import { clipEnd, formatOf, projectRef, soundOf } from "@/modules/project";
import {
  deleteClips,
  editSoundOnly,
  minClipDuration,
  rippleDelete,
  splitAt,
} from "@/modules/timeline";
import { VOLUME_KEYS, levelPlan } from "./logic/level";
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
    "Cuts the silent stretches out of clips with sound, as one undo step. Silence is FFmpeg's silencedetect over the part of the file each clip plays: quieter than thresholdDb (default -35 dBFS) for at least minMs (default 400); padMs (default 100) of quiet stays on each side of a cut. It never scans: run sound_find_silences first with the same clipIds, thresholdDb, minMs and padMs (the scan is kept), or it fails with sound.silences_missing. A linked picture and sound are cut together (a jump cut). With soundOnly, only clips on audio tracks are cut (linked ones unlinked first, as sound editing does) and the gaps stay, so the pictures are untouched; closeGaps is refused with it. With closeGaps, what follows each cut on its tracks (and its linked clips) moves earlier by the removed time, and tracks that hold nothing of these clips do not move, so they drift against them: check the tracks first. Clips with no sound file of their own (text, images, held frames, a video with no sound stream) are skipped. Returns { cuts, removed } (microseconds taken out). Fails with sound.silences_missing, sound.no_silence when nothing is found or the clip has no sound (nothing changes), sound.clip_not_found, sound.close_gaps_sound_only, timeline.not_sound, junction.split_in_overlap.",
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
    return editSoundOnly(ctx, clipIds, soundOnly, async (ids) => {
      // The scan ran before this command (the dialog, or sound_find_silences): it never waits on FFmpeg.
      const found = silences.kept(ids, params);
      if (!found) {
        throw new CommandFailure(
          "sound.silences_missing",
          "These clips haven't been scanned for silence with these values: run sound_find_silences first.",
        );
      }
      // Latest first: a cut never moves what is cut before it, even when it closes its gap.
      const cuts = found
        .flatMap(({ clipId, cuts }) => cuts.map((cut) => ({ clipId, ...cut })))
        .sort((a, b) => b.start - a.start);
      if (cuts.length === 0) {
        throw new CommandFailure(
          "sound.no_silence",
          found.length > 0 && found.every((f) => f.noSound)
            ? "No sound in this clip."
            : "No silence found at this threshold: raise it, or shorten the minimum.",
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
  },
});

/**
 * Brings clips to the same loudness. Each clip is measured as heard through its own volume (static
 * or keyed), over the part of its file it plays, before its fades, EQ, track and master; the change
 * is added to its volume, or to every volume key alike.
 */
export const matchLevel = defineCommand({
  id: "sound.matchLevel",
  label: "Match level",
  description:
    "Brings clips with sound to the same loudness (integrated LUFS, BS.1770), as one undo step. Each clip is measured as heard through its own volume (its static volume, or its volume keys), over the part of its file it plays between its trims and speed, before its fades, EQ, track and master. The change is relative, targetLufs minus that loudness in dB: added to its volume (kept within -60 to 12), or to every volume key alike so the curve keeps its shape (a key that would pass the range stops at its edge). Changing a clip's volume afterwards makes its measurement stale (sound.levels_missing). targetLufs (-70 to 0) defaults to the loudest clip named, which turns nothing up past it. It never measures: run sound_measure_clips first with the same clipIds (the measurements are kept), or it fails with sound.levels_missing. A picture clip is matched through its linked sound. Clips with no sound of their own (text, images, held frames, a nested composition, a file with no sound stream) and silent clips are skipped and named in skipped. Levels and changes are rounded to 0.01 dB, and what is applied is what is reported. Returns { target, changes: [{ clipId, lufs, deltaDb, volumeDb (null when its keys moved), clamped }], skipped: [{ clipId, reason }] }. Fails with sound.levels_missing, sound.clip_not_found, sound.nothing_to_match (nothing measurable, nothing changes).",
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string()).min(1),
    targetLufs: z.number().min(-70).max(0).optional(),
  }),
  async run(ctx, { clipIds, targetLufs }) {
    const project = ctx.require(projectRef).store;
    for (const id of clipIds) {
      if (!project.getState().clips[id]) {
        throw new CommandFailure("sound.clip_not_found", `No clip ${id}.`);
      }
    }
    // The measuring ran before this command (the dialog, or sound_measure_clips): it never waits on FFmpeg.
    const measured = ctx.require(soundRef).loudness.kept(clipIds);
    if (!measured) {
      throw new CommandFailure(
        "sound.levels_missing",
        "These clips haven't been measured: run sound_measure_clips first.",
      );
    }
    const state = project.getState();
    const plan = levelPlan(state, measured, targetLufs);
    if (plan.changes.length === 0) {
      throw new CommandFailure(
        "sound.nothing_to_match",
        `No clip with sound to match. ${plan.skipped.map((s) => s.reason).join(" ")}`.trim(),
      );
    }
    for (const change of plan.changes) {
      if (change.volumeDb === null) {
        const keys = state.clips[change.clipId]!.animation![VOLUME_KEYS]!.keys;
        await ctx.execute(setKeyValues, {
          keys: keys.map((key) => ({
            clipId: change.clipId,
            path: VOLUME_KEYS,
            keyId: key.id,
            offset: change.deltaDb,
          })),
        });
      } else if (change.volumeDb !== soundOf(state.clips[change.clipId]!).volumeDb) {
        await ctx.execute(setSound, {
          clipIds: [change.clipId],
          patch: { volumeDb: change.volumeDb },
        });
      }
    }
    return plan;
  },
});

/** Stops the silence scans and loudness measurements its caller started; others' go on. */
export const cancelScans = defineCommand({
  id: "sound.cancelScans",
  label: "Cancel scans",
  description:
    "Stops the silence scans (sound_find_silences) and loudness measurements (sound_measure_clips) you started and that still run; the user's and other agents' go on. What finished stays kept.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    ctx.require(soundRef).scans.cancel(ctx.actor);
  },
});

/** The tools commands, for the module. */
export const soundToolsCommands = [stripSilence, matchLevel, cancelScans];
