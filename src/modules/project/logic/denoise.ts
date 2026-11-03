import type {
  Composition,
  CompositionId,
  DenoiseEffect,
  DenoiseNeed,
  ProjectState,
  SoundEffect,
  Track,
} from "../project.types";
import { speedOf } from "./speed";

/** A chain's noise reduction when it takes some noise away: on, with an amount above 0. */
function workingDenoise(chain: readonly SoundEffect[] | undefined): DenoiseEffect | undefined {
  const denoise = chain?.find((effect) => effect.kind === "denoise");
  return denoise?.on && denoise.amountDb > 0 ? denoise : undefined;
}

/**
 * The noise reduction the clips heard through a top-level track get: the track's own, otherwise
 * the master's of its composition; undefined when neither takes any noise away. It's rendered
 * into each file, so it applies first, before clip volume and every other effect wherever it sits
 * in its chain, and a clip is reduced once: the master's is per file, for the tracks without their
 * own, not a bus effect. Inside a placement the outer track's counts.
 */
export function heardDenoise(
  track: Pick<Track, "mix">,
  composition: Pick<Composition, "mix">,
): DenoiseEffect | undefined {
  return workingDenoise(track.mix?.effects) ?? workingDenoise(composition.mix?.master.effects);
}

/**
 * Every file heard through noise reduction when `compositionId` plays, by `heardDenoise`, as the
 * preview and the export's mixdown hear it: clips of unmuted audio tracks that aren't disabled,
 * inside placed compositions too (with the outer track's), images left out. Once per file, effect
 * and direction. Whether a file has sound at all is the caller's to check.
 */
export function denoiseNeeds(
  state: Pick<ProjectState, "compositions" | "tracks" | "clips" | "media">,
  compositionId: CompositionId,
): DenoiseNeed[] {
  const needs = new Map<string, DenoiseNeed>();
  const walk = (id: CompositionId, around: DenoiseEffect | undefined | null, path: string[]) => {
    const composition = state.compositions[id];
    if (!composition || path.includes(id)) return;
    for (const trackId of composition.trackOrder) {
      const track = state.tracks[trackId];
      if (track?.kind !== "audio" || track.muted) continue;
      const denoise = around === null ? heardDenoise(track, composition) : around;
      if (!denoise) continue;
      for (const clipId of track.clipIds) {
        const clip = state.clips[clipId];
        if (!clip || clip.disabled) continue;
        if (clip.compositionRef !== undefined) {
          walk(clip.compositionRef, denoise, [...path, id]);
          continue;
        }
        if (clip.mediaId === undefined || state.media[clip.mediaId]?.kind === "image") continue;
        const reversed = speedOf(clip).reversed;
        needs.set(`${clip.mediaId}|${denoise.id}|${reversed}`, {
          mediaId: clip.mediaId,
          denoise,
          reversed,
        });
      }
    }
  };
  walk(compositionId, null, []);
  return [...needs.values()];
}
