import type { StoreApi } from "zustand";
import type { Logger } from "@/core";
import type { CompositionId, ProjectState } from "@/modules/project";
import { cancelAnalysis, beginAnalysis, finishAnalysis } from "./sound.service";
import type { Analyzer, AnalysisState, StoredAnalysis } from "./sound.types";

/**
 * Creates the analyzer of a kernel: it measures outside the command bus (an analysis of a long mix
 * outlasts the bus's timeout), keeps the result with the project state it measured, and reports
 * progress in the store.
 */
export function createAnalyzer(
  state: StoreApi<AnalysisState>,
  project: () => ProjectState,
  log: Logger,
): Analyzer {
  const jobs = new Map<CompositionId, string>();
  /** Cancels asked for while the job was still starting. */
  const cancelled = new Set<CompositionId>();
  const waiting = new Map<CompositionId, Promise<StoredAnalysis | null>>();
  const without = <T>(record: Record<string, T>, key: string) =>
    Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

  return {
    state,
    async start(compositionId, spec, peakDbtp) {
      if (state.getState().running[compositionId]) return;
      const measured = project();
      let progress = 0;
      // Marked before the first await, so a second start can't pass the check above.
      state.setState((s) => ({
        running: { ...s.running, [compositionId]: { jobId: null, progress } },
        failed: without(s.failed, compositionId),
      }));
      let jobId: string;
      try {
        jobId = await beginAnalysis(spec, peakDbtp, (value) => {
          progress = value;
          state.setState((s) =>
            s.running[compositionId]
              ? {
                  running: {
                    ...s.running,
                    [compositionId]: { jobId: s.running[compositionId].jobId, progress },
                  },
                }
              : s,
          );
        });
      } catch (error) {
        state.setState((s) => ({ running: without(s.running, compositionId) }));
        throw error;
      }
      state.setState((s) => ({
        running: { ...s.running, [compositionId]: { jobId, progress } },
      }));
      jobs.set(compositionId, jobId);
      if (cancelled.delete(compositionId)) void cancelAnalysis(jobId).catch(() => undefined);
      const done = finishAnalysis(jobId).then(
        (result) => {
          const stored: StoredAnalysis = { result, measured, peakDbtp };
          state.setState((s) => ({
            running: without(s.running, compositionId),
            results: { ...s.results, [compositionId]: stored },
          }));
          return stored;
        },
        (error: unknown) => {
          const message =
            typeof error === "object" && error !== null && "message" in error
              ? String(error.message)
              : String(error);
          if (message !== "Cancelled") log.error("Analysis failed", error);
          state.setState((s) => ({
            running: without(s.running, compositionId),
            ...(message !== "Cancelled" && { failed: { ...s.failed, [compositionId]: message } }),
          }));
          return null;
        },
      );
      waiting.set(compositionId, done);
      void done.finally(() => {
        waiting.delete(compositionId);
        jobs.delete(compositionId);
      });
    },
    async cancel(compositionId) {
      const run = state.getState().running[compositionId];
      if (!run) return;
      if (run.jobId === null) cancelled.add(compositionId);
      else await cancelAnalysis(run.jobId);
    },
    settled: (compositionId) => waiting.get(compositionId) ?? Promise.resolve(null),
    dispose() {
      for (const jobId of jobs.values()) void cancelAnalysis(jobId).catch(() => undefined);
      for (const id of Object.keys(state.getState().running)) cancelled.add(id);
    },
  };
}
