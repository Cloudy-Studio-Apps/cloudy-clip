import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { importMedia } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { addClip, addTrack } from "@/modules/timeline";
import { audioTrack } from "./sound.guards";

/**
 * Imports a recorded file and places it on an audio track at `at`: one undo step. When the track
 * is taken there (an earlier take), the take goes on a new audio track right under it. The file is
 * read first (`media.prepareFile`, outside the bus), so this never waits on a probe. No MCP tool:
 * the microphone is the user's, and agents place files with `media_import` and `timeline_add_clip`.
 */
export const placeRecording = defineCommand({
  id: "sound.placeRecording",
  label: "Record",
  description:
    "Imports a recording (an audio file at an absolute path) and places it on the audio track trackId at `at` (microseconds), in one undo step. When that spot of the track is taken, the take goes on a new audio track right under it. The file should be read first with the media module's prepareFile, else this fails with media.not_ready. Returns { mediaId, clipId, trackId }. Fails with sound.track_not_found, sound.not_audio, media.import_failed, media.not_ready.",
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
