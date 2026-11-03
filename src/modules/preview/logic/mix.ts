import {
  compositionMixOf,
  nestedSound,
  trackMixOf,
  type Composition,
  type ProjectState,
  type Track,
} from "@/modules/project";
import type { MixUpdate, Nesting, Placed } from "../engine/engine.types";
import type { LiveSound, MonitorState } from "../preview.types";

/** How the user listens until told otherwise: stereo, not dimmed, speakers at 0 dB. */
export const DEFAULT_MONITOR: MonitorState = { mono: false, dim: false, speakerDb: 0 };

/** No live values, no solo, the default monitor. */
export const NO_LIVE_SOUND: LiveSound = { mix: new Map(), solo: [], monitor: DEFAULT_MONITOR };

/** The open composition's mix with the live values over it, for the buses. */
export function mixUpdateOf(
  project: ProjectState,
  composition: Composition,
  { mix, solo, monitor }: LiveSound,
): MixUpdate {
  const tracks = composition.trackOrder.flatMap((id) => {
    const track = project.tracks[id];
    if (track?.kind !== "audio") return [];
    return [{ id, mix: { ...trackMixOf(track), ...mix.get(id) }, muted: track.muted }];
  });
  const master = { ...compositionMixOf(composition).master, ...mix.get("master") };
  // Solo outlives a deleted track and a switch of composition: only this one's tracks count, so a
  // solo of none of them is no solo, not silence.
  const soloed = solo.filter((id) => tracks.some((track) => track.id === id));
  return { tracks, master: { volumeDb: master.volumeDb }, solo: soloed, monitor };
}

/**
 * Where a clip (or a placement) on `track` sounds from: a top-level track's own bus, at its own
 * gain and pan; inside a placement, the bus of the track the placement sits on, with this inner
 * track's volume and pan added to those of the inner tracks above it.
 */
export function placeSound(
  track: Track,
  nesting: Nesting | null,
  gain: number,
  pan: number,
): Placed {
  if (!nesting) return { bus: track.id, gain, pan };
  return { bus: nesting.bus, ...nestedSound(gain, pan + nesting.pan, trackMixOf(track)) };
}
