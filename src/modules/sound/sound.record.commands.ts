import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { importMedia, mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { addClip, addTrack } from "@/modules/timeline";
import { audioTrack } from "./sound.guards";

/** How long placing waits for the file's length to be read, in ms. A WAV takes a moment. */
const PROBE_WAIT_MS = 10_000;

/**
 * Imports a recorded file and places it on an audio track at `at`: one undo step. When the track
 * is taken there (an earlier take), the take goes on a new audio track right under it.
 */
export const placeRecording = defineCommand({
  id: "sound.placeRecording",
  label: "Record",
  description:
    "Imports a recording (an audio file at an absolute path) and places it on the audio track trackId at `at` (microseconds), in one undo step. When that spot of the track is taken, the take goes on a new audio track right under it. Returns { mediaId, clipId, trackId }. Fails with sound.track_not_found, sound.not_audio, media.import_failed, media.not_ready.",
  undoable: true,
  input: z.object({
    trackId: z.string(),
    path: z.string().min(1),
    at: z.number().int().min(0).describe("Microseconds"),
  }),
  async run(ctx, { trackId, path, at }) {
    const { store } = ctx.require(projectRef);
    const track = audioTrack(store.getState(), trackId);
    const { imported } = await ctx.execute(importMedia, { paths: [path] });
    const media = imported[0];
    if (!media) throw new CommandFailure("media.import_failed", `"${path}" wasn't imported`);
    // Placing needs the file's length, read once the import has landed.
    await ctx.require(mediaRef).waitForProbe(media.id, PROBE_WAIT_MS);
    const place = async (onto: string) => {
      const { clips } = await ctx.execute(addClip, { mediaId: media.id, trackId: onto, start: at });
      return { mediaId: media.id, clipId: clips[0]!.id, trackId: onto };
    };
    try {
      return await place(trackId);
    } catch (error) {
      if (!(error instanceof CommandFailure) || error.code !== "timeline.overlap") throw error;
    }
    const order = store.getState().compositions[track.compositionId]?.trackOrder ?? [];
    const { trackId: below } = await ctx.execute(addTrack, {
      kind: "audio",
      compositionId: track.compositionId,
      index: order.indexOf(trackId) + 1,
    });
    return place(below);
  },
});

/** The recording commands. Recording itself has no command: the microphone is the user's. */
export const soundRecordCommands = [placeRecording];
