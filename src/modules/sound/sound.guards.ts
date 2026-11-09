import { CommandFailure } from "@/core";
import {
  compositionMixOf,
  type BusId,
  type CompositionId,
  type MixBus,
  type ProjectState,
  type Track,
  type TrackId,
} from "@/modules/project";

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

/** The group of a composition's mix with this id, or the failure to throw. */
export function requireBus(
  state: ProjectState,
  compositionId: CompositionId,
  busId: BusId,
): MixBus {
  const composition = state.compositions[compositionId];
  const bus = composition && compositionMixOf(composition).buses?.find((b) => b.id === busId);
  if (!bus) throw new CommandFailure("sound.bus_not_found", `No group with id "${busId}" here.`);
  return bus;
}
