import type { CommandContext } from "@/core";
import {
  minimizeCompositionMix,
  minimizeTrackMix,
  projectRef,
  requireComposition,
  type CompositionId,
  type CompositionMix,
  type Track,
} from "@/modules/project";

/** Writes a track's mix, or removes it at the defaults (an empty chain counts as none). */
export function writeTrack(track: Track, mix: Track["mix"]): void {
  const next = mix && minimizeTrackMix(mix);
  if (next) track.mix = next;
  else delete track.mix;
}

/** Writes a composition's mix, or removes it at the defaults (an empty master chain counts as none). */
export function writeComposition(composition: { mix?: CompositionMix }, mix: CompositionMix): void {
  const next = minimizeCompositionMix(mix);
  if (next) composition.mix = next;
  else delete composition.mix;
}

/** The composition: given, or the one the actor has open. */
export function targetComposition(ctx: CommandContext, compositionId: CompositionId | undefined) {
  const project = ctx.require(projectRef);
  const id = compositionId ?? project.view.requireOpen(ctx.actor).id;
  return requireComposition(project.store.getState(), id).id;
}
