import type {
  Composition,
  CompositionMix,
  MasterMix,
  MixBus,
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

/** A group without an empty chain. */
function minimizeBus(bus: MixBus): MixBus {
  const { effects, ...rest } = bus;
  return effects?.length ? bus : rest;
}

/** A master without what it has anyway: a centred pan, no trim, no mute, an empty chain, a line with no keys. */
export function minimizeMaster(master: MasterMix): MasterMix {
  const { pan, muted, effects, volumeLine, trimDb, ...rest } = master;
  return {
    ...rest,
    ...(pan !== undefined && pan !== 0 && { pan }),
    ...(trimDb !== undefined && trimDb !== 0 && { trimDb }),
    ...(muted === true && { muted }),
    ...(effects?.length && { effects }),
    ...(volumeLine?.keys.length && { volumeLine }),
  };
}

/** `mix`, or undefined when it's what a composition has anyway; no groups means none stored; the master is minimized (`minimizeMaster`). */
export function minimizeCompositionMix(mix: CompositionMix): CompositionMix | undefined {
  const { buses, ...rest } = mix;
  const kept = buses?.length ? { buses: buses.map(minimizeBus) } : {};
  return minimize(
    { ...rest, ...kept, master: minimizeMaster(mix.master) },
    DEFAULT_COMPOSITION_MIX,
  );
}

/**
 * The group `track` sends to in `composition`; undefined when it sends to Master, or names a group
 * the composition doesn't have (which then sounds as Master).
 */
export function trackBus(
  composition: Pick<Composition, "mix"> | undefined,
  track: Pick<Track, "mix">,
): MixBus | undefined {
  const busId = track.mix?.busId;
  if (busId === undefined || !composition) return undefined;
  return composition.mix?.buses?.find((bus) => bus.id === busId);
}

/**
 * The gain and pan of a clip (or a placement) on an inner `track` of a placed composition, where
 * the inner tracks above it have panned `nestingPan` in total: gain times the track's volume (and
 * the volume of the group it sends to there, `bus`), and the pans summed with the track's, kept
 * within -1..1. The preview's `placeSound` and the export's mixdown both use it, so they fold
 * nesting alike. A muted group silences its tracks as their own mute does, which the callers
 * check with the track's `muted`.
 */
export function soundInPlacement(
  track: Pick<Track, "mix">,
  nestingPan: number,
  gain: number,
  pan: number,
  bus?: Pick<MixBus, "volumeDb">,
): { gain: number; pan: number } {
  const inner = trackMixOf(track);
  const group = bus ? dbToLinear(bus.volumeDb) : 1;
  return {
    gain: gain * dbToLinear(inner.volumeDb) * group,
    pan: Math.min(1, Math.max(-1, pan + nestingPan + inner.pan)),
  };
}
