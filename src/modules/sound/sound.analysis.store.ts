import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand";
import type { CompositionId, ProjectState } from "@/modules/project";
import type { AnalysisState, StoredAnalysis } from "./sound.delivery.types";

/** Creates the whole-mix analyses and Match targets of one kernel: none yet. View state, never in history. */
export function createAnalysisStore(): StoreApi<AnalysisState> {
  return createStore<AnalysisState>()(() => ({
    results: {},
    running: {},
    failed: {},
    matching: {},
    matched: {},
    matchFailed: {},
  }));
}

/**
 * Whether the document has changed since the analysis was made: any edit (and an undo) gives the
 * project a new state, so the figures no longer describe what is on the timeline.
 */
export function isStale(stored: StoredAnalysis, project: ProjectState): boolean {
  return stored.measured !== project;
}

/** The stored analysis of a composition, if any. */
export function storedFor(
  store: StoreApi<AnalysisState>,
  compositionId: CompositionId,
): StoredAnalysis | undefined {
  return store.getState().results[compositionId];
}
