import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { importMedia } from "@/modules/media";
import { projectRef, requireComposition } from "@/modules/project";
import { addClip, addTrack, nextTrackName } from "@/modules/timeline";
import { VOICE_TRACK } from "./logic/record";
import { audioTrack } from "./sound.guards";

/**
 * Imports a recorded file and places it at `at`: one undo step. Onto the audio track `trackId`;
 * when that spot is taken (an earlier take), onto a new audio track right under it. Without
 * `trackId`, onto a new Voice track (`Voice 1`, `Voice 2`…) added at the bottom of `compositionId`,
 * in the same step, so one undo takes the take and its track away together. The file is read first
 * (`media.prepareFile`, outside the bus), so this never waits on a probe. No MCP tool: the
 * microphone is the user's, and agents place files with `media_import` and `timeline_add_clip`.
 */
export const placeRecording = defineCommand({
  id: "sound.placeRecording",
  label: "Record",
  description:
    "Imports a recording (an audio file at an absolute path) and places it at `at` (microseconds), in one undo step: on the audio track trackId, or, without trackId, on a new audio track named Voice n added at the bottom of compositionId. When the spot on trackId is taken, the take goes on a new audio track right under it. The file should be read first with the media module's prepareFile, else this fails with media.not_ready. Returns { mediaId, clipId, trackId }. Fails with sound.track_not_found, sound.not_audio, composition.not_found, media.import_failed, media.not_ready.",
  undoable: true,
  input: z
    .object({
      trackId: z.string().optional(),
      compositionId: z.string().optional(),
      path: z.string().min(1),
      at: z.number().int().min(0).describe("Microseconds"),
    })
    .refine((input) => (input.trackId === undefined) !== (input.compositionId === undefined), {
      message: "Pass trackId, or compositionId for a new Voice track",
    }),
  async run(ctx, { trackId, compositionId, path, at }) {
    const { store } = ctx.require(projectRef);
    const track = trackId === undefined ? undefined : audioTrack(store.getState(), trackId);
    if (compositionId !== undefined) requireComposition(store.getState(), compositionId);
    const { imported } = await ctx.execute(importMedia, { paths: [path] });
    const media = imported[0];
    if (!media) throw new CommandFailure("media.import_failed", `"${path}" wasn't imported`);
    const place = async (onto: string) => {
      const { clips } = await ctx.execute(addClip, { mediaId: media.id, trackId: onto, start: at });
      return { mediaId: media.id, clipId: clips[0]!.id, trackId: onto };
    };
    if (!track) {
      const home = compositionId!;
      const name = nextTrackName(store.getState(), home, "audio", VOICE_TRACK);
      const { trackId: voice } = await ctx.execute(addTrack, {
        kind: "audio",
        compositionId: home,
        name,
      });
      return place(voice);
    }
    try {
      return await place(track.id);
    } catch (error) {
      if (!(error instanceof CommandFailure) || error.code !== "timeline.overlap") throw error;
    }
    const order = store.getState().compositions[track.compositionId]?.trackOrder ?? [];
    const { trackId: below } = await ctx.execute(addTrack, {
      kind: "audio",
      compositionId: track.compositionId,
      index: order.indexOf(track.id) + 1,
    });
    return place(below);
  },
});

/** The recording commands. Recording itself has no command: the microphone is the user's. */
export const soundRecordCommands = [placeRecording];
