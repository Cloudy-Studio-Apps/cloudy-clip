import { CommandFailure, type CommandContext } from "@/core";
import { mediaHasAudio, mediaRef } from "@/modules/media";
import { projectRef, type CompositionId } from "@/modules/project";
import { mixdown } from "./logic/mixdown";
import { checkDenoised, checkSources, denoisedFiles, rangeOf } from "./export.guards";
import type { SoundOnlySpec } from "./export.types";

/**
 * The sound of a whole composition as a Mix export would mix it (never its stems): the same
 * `mixdown`, with noise reduction rendered, for measuring it without a file. Fails with
 * export.noComposition, export.missingMedia, export.mediaNotReady, export.denoise_pending or
 * export.noSound.
 */
export function soundOnlySpec(ctx: CommandContext, compositionId: CompositionId): SoundOnlySpec {
  const { store } = ctx.require(projectRef);
  const media = ctx.require(mediaRef);
  const project = store.getState();
  const composition = project.compositions[compositionId];
  if (!composition) {
    throw new CommandFailure("export.noComposition", "There's no composition to measure.");
  }
  const range = rangeOf(composition, undefined);
  checkSources(ctx, composition, range);
  const { soundFile, pending } = denoisedFiles(media);
  const mixed = mixdown(
    project,
    composition.id,
    range,
    (id) => mediaHasAudio(media.getProbe(id)),
    soundFile,
  );
  checkDenoised(pending);
  if (mixed.segments.length === 0) {
    throw new CommandFailure("export.noSound", "This composition has no sound.");
  }
  return { duration: range.duration, sound: mixed.segments, mix: mixed.mix };
}
