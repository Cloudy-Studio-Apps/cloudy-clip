import type { CompositionId, DenoiseEffect } from "@/modules/project";
import type { MixTarget } from "../sound.types";
import { useDenoiseRendering } from "./denoise.hook";

interface DenoiseMarkProps {
  target: MixTarget;
  compositionId: CompositionId | undefined;
  effect: DenoiseEffect;
}

/** On a strip's noise reduction row: how far its files are rendered, while they are. */
export function DenoiseMark({ target, compositionId, effect }: DenoiseMarkProps) {
  const rendering = useDenoiseRendering(target, compositionId, effect);
  if (rendering === undefined) return null;
  const percent = Math.round(rendering * 100);
  return (
    <span
      title={`Rendering ${percent}%: the original plays until it's done`}
      className="ml-auto shrink-0 pr-1 text-2xs text-subtle-foreground"
    >
      {percent}%
    </span>
  );
}
