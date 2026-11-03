import { CommandFailure } from "@/core";
import type { ProjectState, Track, TrackId } from "@/modules/project";

/** The audio track with this id, or the failure to throw. */
export function audioTrack(state: ProjectState, trackId: TrackId): Track {
  const track = state.tracks[trackId];
  if (!track) throw new CommandFailure("sound.track_not_found", `No track with id "${trackId}"`);
  if (track.kind !== "audio") {
    throw new CommandFailure(
      "sound.not_audio",
      `Track "${trackId}" is a video track: it has no mix.`,
    );
  }
  return track;
}
