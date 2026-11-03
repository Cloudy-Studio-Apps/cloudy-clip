import type { CompositionId, DenoiseEffect } from "@/modules/project";
import type { MixTarget } from "../sound.types";
import { useDenoiseRendering } from "./denoise.hook";

interface DenoiseMarkProps {
  target: MixTarget;
  compositionId: CompositionId | undefined;
  effect: DenoiseEffect;
}

/** On a strip's noise reduction row: how far its files are rendered while they are, or that one failed. */
export function DenoiseMark({ target, compositionId, effect }: DenoiseMarkProps) {
  const { progress, failed } = useDenoiseRendering(target, compositionId, effect);
  if (failed !== undefined) {
    return (
      <span
        title={`Rendering failed: ${failed} Change a setting to try again; the original plays meanwhile.`}
        className="ml-auto shrink-0 pr-1 text-2xs text-destructive"
      >
        failed
      </span>
    );
  }
  if (progress === undefined) return null;
  const percent = Math.round(progress * 100);
  return (
    <span
      title={`Rendering ${percent}%: the original plays until it's done`}
      className="ml-auto shrink-0 pr-1 text-2xs text-subtle-foreground"
    >
      {percent}%
    </span>
  );
}
