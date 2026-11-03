import { useMemo } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, type CompositionId } from "@/modules/project";
import { chainOf } from "../logic/effects";
import { removeEffect, setEffect } from "../sound.effects.commands";
import type { EffectEdit, MixTarget } from "../sound.types";

/**
 * Changes to the chain of a track or a composition's master. A drag step plays the chain with the
 * effect's new values through `preview.sound.previewMix` and changes nothing; the release is one
 * `sound.setEffect`, after which the saved chain plays again. No React state (rule 24).
 */
export function useEffectEdit(
  target: MixTarget,
  compositionId: CompositionId | undefined,
): EffectEdit {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  return useMemo(() => {
    const where = { target, ...(target === "master" && compositionId && { compositionId }) };
    return {
      live(effect) {
        const chain = chainOf(project.getState(), target, compositionId);
        const effects = chain.map((one) => (one.id === effect.id ? effect : one));
        preview.sound.previewMix(target, { effects });
      },
      async commit(effectId, patch) {
        await bus.run(setEffect, { ...where, effectId, patch });
        preview.sound.previewMix(target, null);
      },
      remove(effectId) {
        void bus.run(removeEffect, { ...where, effectId });
      },
    };
  }, [bus, compositionId, preview, project, target]);
}
