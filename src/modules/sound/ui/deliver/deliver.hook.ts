import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import {
  compositionMixOf,
  projectRef,
  useOpenComposition,
  type CompositionId,
  type DeliverySettings,
} from "@/modules/project";
import { deliveryOf } from "../../logic/standards";
import { soundRef } from "../../sound.ref";
import type { AnalysisState, DeliverView } from "../../sound.types";

/** An analysis-store slice of a composition (`undefined` with none open). */
function useAnalysis<T>(
  compositionId: CompositionId | undefined,
  pick: (state: AnalysisState, id: CompositionId) => T,
): T | undefined {
  const { analyzer } = useModule(soundRef);
  return useStore(analyzer.state, (s) => (compositionId ? pick(s, compositionId) : undefined));
}

/** The standard, target and peak limit the open composition is delivered against. */
export function useDelivery(): {
  compositionId: CompositionId | undefined;
  delivery: DeliverySettings;
} {
  const project = useModule(projectRef).store.api;
  const compositionId = useOpenComposition()?.id;
  const chosen = useStore(project, (s) => {
    const composition = compositionId ? s.compositions[compositionId] : undefined;
    return composition ? compositionMixOf(composition).delivery : undefined;
  });
  const delivery = useMemo(() => deliveryOf({ delivery: chosen }), [chosen]);
  return { compositionId, delivery };
}

/**
 * The delivery settings and the analysis state of the open composition. Each field is a raw slice
 * of a store, so nothing re-renders but on a change of its own; `stale` is a boolean (an edit or
 * an undo gives the project a new state).
 */
export function useDeliver(): DeliverView {
  const project = useModule(projectRef).store.api;
  const { compositionId, delivery } = useDelivery();
  const stored = useAnalysis(compositionId, (s, id) => s.results[id]);
  const stale = useStore(project, (s) => (stored ? s !== stored.measured : false));
  return {
    compositionId,
    delivery,
    stored,
    stale,
    running: useAnalysis(compositionId, (s, id) => s.running[id]),
    failed: useAnalysis(compositionId, (s, id) => s.failed[id]),
    matching: useAnalysis(compositionId, (s, id) => s.matching[id]),
    matched: useAnalysis(compositionId, (s, id) => s.matched[id]),
    matchFailed: useAnalysis(compositionId, (s, id) => s.matchFailed[id]),
  };
}

/** The loudness the open composition is delivered at, LUFS; null with no composition open. */
export function useDeliveryTarget(): number | null {
  const { compositionId, delivery } = useDelivery();
  return compositionId ? delivery.loudnessLufs : null;
}
