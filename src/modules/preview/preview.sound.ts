import type { TrackId, TrackMix } from "@/modules/project";
import { NO_LEVELS } from "./engine/engine.meters";
import { NO_LIVE_SOUND } from "./logic/mix";
import type { LiveSound, PreviewEngine, PreviewSound } from "./preview.types";

/**
 * What the user hears beside the document, kept per kernel and handed to whichever engine is
 * attached. Each change makes a new `LiveSound`, so the engine sets its buses only on a change.
 */
export function createPreviewSound(engine: () => PreviewEngine | null) {
  let live = NO_LIVE_SOUND;
  const change = (next: Partial<LiveSound>) => {
    live = { ...live, ...next };
    engine()?.setSound(live);
  };

  const sound: PreviewSound = {
    previewMix(target: TrackId | "master", patch: Partial<TrackMix> | null) {
      const mix = new Map(live.mix);
      if (patch) mix.set(target, patch);
      else mix.delete(target);
      change({ mix });
    },
    setMonitor: (monitor) => change({ monitor }),
    setSolo: (solo) => change({ solo: [...solo] }),
    levels: () => engine()?.levels() ?? NO_LEVELS,
    // Measured by the loudness worklet on the master; null until it has, and without an engine.
    loudness: () => engine()?.loudness() ?? null,
    resetLoudness: () => engine()?.resetLoudness(),
  };
  return { sound, current: () => live };
}
