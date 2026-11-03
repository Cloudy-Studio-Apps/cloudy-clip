import type { Composition, ProjectState } from "@/modules/project";
import { mixUpdateOf, NO_LIVE_SOUND } from "../logic/mix";
import type { LiveSound } from "../preview.types";
import { createSoundAtSpeed } from "./engine.audio";
import { createSoundGraph } from "./engine.audiograph";
import { NO_LEVELS } from "./engine.meters";
import type { SoundMix } from "./engine.types";

/**
 * The sound side of one engine: its graph, the live sound from the controller, and when the
 * buses are set. A picture-only engine gets one with no graph.
 */
export function createSoundMix(pictureOnly: boolean): SoundMix {
  const graph = pictureOnly ? null : createSoundGraph();
  let live: LiveSound = NO_LIVE_SOUND;
  /** What the buses were last set from, so they change only when one of these does. */
  let mixed: { project: ProjectState; composition: Composition; live: LiveSound } | null = null;

  const update = (project: ProjectState, composition: Composition) => {
    if (!graph) return;
    const same = mixed?.composition === composition && mixed.live === live;
    if (same && mixed?.project.tracks === project.tracks) return;
    mixed = { project, composition, live };
    graph.mix(mixUpdateOf(project, composition, live));
  };

  return {
    graph,
    heard: createSoundAtSpeed(),
    update,
    setSound(next) {
      live = next;
      if (mixed) update(mixed.project, mixed.composition);
    },
    levels: () => graph?.levels() ?? NO_LEVELS,
    loudness: () => graph?.loudness() ?? null,
    resetLoudness: () => graph?.resetLoudness(),
    setPlaying: (playing) => graph?.setPlaying(playing),
    dispose: () => graph?.dispose(),
  };
}
