import type { Composition, CompositionMix, Track, TrackMix } from "../project.types";
import { dbToLinear, minimize } from "./sound";

/** How an audio track mixes until it's changed: as its clips sound. */
export const DEFAULT_TRACK_MIX: TrackMix = { volumeDb: 0, pan: 0 };

/** How a composition mixes until it's changed: the master at 0 dB, mix A active. */
export const DEFAULT_COMPOSITION_MIX: CompositionMix = { master: { volumeDb: 0 }, activeMix: "a" };

/** A track's mix; the defaults when it has none of its own. */
export function trackMixOf(track: Pick<Track, "mix">): TrackMix {
  return track.mix ? { ...DEFAULT_TRACK_MIX, ...track.mix } : DEFAULT_TRACK_MIX;
}

/** A composition's mix; the defaults when it has none of its own. */
export function compositionMixOf(composition: Pick<Composition, "mix">): CompositionMix {
  return composition.mix
    ? { ...DEFAULT_COMPOSITION_MIX, ...composition.mix }
    : DEFAULT_COMPOSITION_MIX;
}

/** `mix`, or undefined when it's what a track has anyway, so defaults are never stored. */
export function minimizeTrackMix(mix: TrackMix): TrackMix | undefined {
  return minimize(mix, DEFAULT_TRACK_MIX);
}

/**
 * The gain and pan of a clip inside a placed composition, once the inner track's mix is applied:
 * gain times the track's volume, pan summed and kept within -1..1. Preview and export both use it.
 */
export function nestedSound(
  clipGain: number,
  clipPan: number,
  inner: TrackMix,
): { gain: number; pan: number } {
  return {
    gain: clipGain * dbToLinear(inner.volumeDb),
    pan: Math.min(1, Math.max(-1, clipPan + inner.pan)),
  };
}
