import { z } from "zod";
import { CommandFailure, defineCommand, toAppError, type Micros } from "@/core";
import { mediaHasAudio, mediaRef } from "@/modules/media";
import { previewRef } from "@/modules/preview";
import { clipEnd, projectRef, sourceTimeAt, trackMixOf } from "@/modules/project";
import { audioTrack } from "./sound.guards";
import { measureNoiseFloor } from "./sound.service";
import { setEffect } from "./sound.effects.commands";

/** How much of a file is measured when the stretch isn't given. */
const MEASURED: Micros = 1_000_000;

/** Sets the noise floor of a track's noise reduction to what a stretch of its sound measures. */
export const measureFloor = defineCommand({
  id: "sound.measureFloor",
  label: "Measure noise floor",
  description:
    "Measures the noise floor of an audio track's sound from `at` (default your playhead) for `duration` (default 1 s, cut at the end of the clip there) and sets its noise reduction's floorDb to it (rounded, -80..-20 dBFS), as one undo step. Pick a stretch with only the noise in it, no voice or music. The track needs a noise reduction effect (add it with sound_add_effect, kind denoise) and a clip of a file with sound at `at`. Fails with sound.effect_not_found, sound.nothing_to_measure and sound.measure_failed. Returns { floorDb }.",
  undoable: true,
  input: z.object({
    trackId: z.string().describe("An audio track id."),
    at: z.number().int().min(0).optional().describe("Timeline time, in microseconds."),
    duration: z.number().int().positive().optional().describe("In microseconds."),
  }),
  async run(ctx, { trackId, at, duration = MEASURED }) {
    const state = ctx.require(projectRef).store.getState();
    const track = audioTrack(state, trackId);
    const denoise = trackMixOf(track).effects?.find((effect) => effect.kind === "denoise");
    if (!denoise) {
      throw new CommandFailure("sound.effect_not_found", `"${track.name}" has no noise reduction.`);
    }
    const media = ctx.require(mediaRef);
    const time = at ?? ctx.require(previewRef).clockFor(ctx.actor).getTime();
    const clip = track.clipIds
      .map((id) => state.clips[id])
      .find((one) => one && !one.disabled && one.start <= time && time < clipEnd(one));
    if (clip?.mediaId === undefined || !mediaHasAudio(media.getProbe(clip.mediaId))) {
      throw new CommandFailure(
        "sound.nothing_to_measure",
        `"${track.name}" has no clip of a file with sound there.`,
      );
    }
    // In file time; a reversed clip runs through the file the other way.
    const ends = [time, Math.min(time + duration, clipEnd(clip))].map((t) => sourceTimeAt(clip, t));
    const floorDb = await measureNoiseFloor(
      clip.mediaId,
      Math.min(...ends),
      Math.max(...ends),
    ).catch((error: unknown) => {
      throw new CommandFailure(
        "sound.measure_failed",
        `Could not measure: ${toAppError(error).message}`,
      );
    });
    await ctx.execute(setEffect, { target: trackId, effectId: denoise.id, patch: { floorDb } });
    return { floorDb };
  },
});

/** Every noise reduction command, for the module. */
export const soundDenoiseCommands = [measureFloor];
