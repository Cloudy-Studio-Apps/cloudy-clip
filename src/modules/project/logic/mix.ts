import type {
  Composition,
  CompositionMix,
  DenoiseEffect,
  SoundEffect,
  Track,
  TrackMix,
} from "../project.types";
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
  const { effects, ...rest } = mix;
  return minimize(effects?.length ? mix : rest, DEFAULT_TRACK_MIX);
}

/** `mix`, or undefined when it's what a composition has anyway; an empty master chain is dropped. */
export function minimizeCompositionMix(mix: CompositionMix): CompositionMix | undefined {
  const { effects, ...master } = mix.master;
  return minimize(effects?.length ? mix : { ...mix, master }, DEFAULT_COMPOSITION_MIX);
}

/**
 * The gain and pan of a clip (or a placement) on an inner `track` of a placed composition, where
 * the inner tracks above it have panned `nestingPan` in total: gain times the track's volume, and
 * the pans summed with the track's, kept within -1..1. The preview's `placeSound` and the export's
 * mixdown both use it, so they fold nesting alike.
 */
export function soundInPlacement(
  track: Pick<Track, "mix">,
  nestingPan: number,
  gain: number,
  pan: number,
): { gain: number; pan: number } {
  const inner = trackMixOf(track);
  return {
    gain: gain * dbToLinear(inner.volumeDb),
    pan: Math.min(1, Math.max(-1, pan + nestingPan + inner.pan)),
  };
}

/** A chain's noise reduction when it takes some noise away: on, with an amount above 0. */
function workingDenoise(chain: readonly SoundEffect[] | undefined): DenoiseEffect | undefined {
  const denoise = chain?.find((effect) => effect.kind === "denoise");
  return denoise?.on && denoise.amountDb > 0 ? denoise : undefined;
}

/**
 * The noise reduction the clips heard through a top-level track get: the track's own, otherwise
 * the master's of its composition; undefined when neither takes any noise away. It's rendered
 * into each file, so a clip is reduced once, and inside a placement the outer track's counts.
 * The preview and the export's mixdown both read it here, so they hear the same files.
 */
export function heardDenoise(
  track: Pick<Track, "mix">,
  composition: Pick<Composition, "mix">,
): DenoiseEffect | undefined {
  return workingDenoise(track.mix?.effects) ?? workingDenoise(composition.mix?.master.effects);
}
