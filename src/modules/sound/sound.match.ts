import { notify } from "@/core";
import { withCorrection, type MasterCorrection, type SoundOnlySpec } from "@/modules/export";
import {
  compositionMixOf,
  type CompositionId,
  type DeliverySettings,
  type MasterMix,
} from "@/modules/project";
import { isStale, storedFor } from "./sound.analysis.store";
import { analyzeMix, matchTarget } from "./sound.delivery.commands";
import { measureOnce } from "./sound.measure";
import { deliveryOf } from "./logic/standards";
import { correctionGain, firstChange, limiterPlan, secondStep } from "./logic/match";
import type {
  AnalysisState,
  LimiterPlan,
  MatchBy,
  Matcher,
  MatcherDeps,
  MatchOutcome,
  MatchRun,
  MixAnalysis,
  SecondStep,
  StoredAnalysis,
} from "./sound.types";

const CANCELLED = "Cancelled";
const CHANGED = "The project changed while matching: match again.";

/** What a correction adds: a level, and matching's own limiter at `ceilingDb`. */
function correctionOf(gainDb: number, limiter: LimiterPlan, ceilingDb: number): MasterCorrection {
  return {
    gainDb,
    ...(limiter.own && { limiter: { ceilingDb, releaseMs: limiter.releaseMs } }),
  };
}

/** A failure's message. */
function messageOf(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String(error.message)
    : String(error);
}

const without = <T>(record: Record<string, T>, key: string) =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

/**
 * The measuring after the first step, on the side: `spec` measured with Master moved by
 * `changeDb` and the limiter at the peak limit (a correction of the spec only), and the second
 * step worked out from it.
 */
async function correct(
  spec: SoundOnlySpec,
  master: MasterMix,
  delivery: DeliverySettings,
  before: MixAnalysis,
  changeDb: number,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<{ limiter: LimiterPlan; step: SecondStep }> {
  const limiter = limiterPlan(master, delivery.peakDbtp);
  const checked = withCorrection(spec, correctionOf(changeDb, limiter, limiter.ceilingDb));
  const after = await measureOnce(checked, delivery.peakDbtp, onProgress, signal);
  const step = secondStep({
    before,
    after,
    changeDb,
    targetLufs: delivery.loudnessLufs,
    peakDbtp: delivery.peakDbtp,
    limiter,
  });
  return { limiter, step };
}

/**
 * Creates Match target for one kernel: measure (the stored analysis, when fresh), move Master and
 * add the limiter in a correction of the analysis spec only, measure again, then one undoable
 * `sound.matchTarget` with both steps, and an analysis of where the mix landed. The project is
 * written once.
 */
export function createMatcher({ analyzer, bus, project, log }: MatcherDeps): Matcher {
  const { state } = analyzer;
  const aborts = new Map<CompositionId, AbortController>();
  const waiting = new Map<CompositionId, Promise<MatchOutcome | null>>();

  const enter = (id: CompositionId, run: MatchRun) =>
    state.setState((s: AnalysisState) => ({ matching: { ...s.matching, [id]: run } }));

  /**
   * Waits for the analyzer's job, showing its progress as the step's; then the stored analysis if
   * it describes the project as it is, or null.
   */
  async function follow(id: CompositionId): Promise<StoredAnalysis | null> {
    const unsubscribe = state.subscribe((s) => {
      const running = s.running[id];
      const run = s.matching[id];
      if (running && run && running.progress !== run.progress) {
        enter(id, { ...run, progress: running.progress });
      }
    });
    try {
      await analyzer.settled(id);
    } finally {
      unsubscribe();
    }
    const stored = storedFor(state, id);
    return stored && !isStale(stored, project()) ? stored : null;
  }

  /** A fresh analysis of the composition: the stored one, or a new one of `spec`. */
  async function fresh(
    id: CompositionId,
    spec: SoundOnlySpec,
    signal: AbortSignal,
  ): Promise<StoredAnalysis> {
    if (state.getState().running[id]) await follow(id);
    let stored = storedFor(state, id);
    if (!stored || isStale(stored, project())) {
      const { peakDbtp } = deliveryOf(compositionMixOf(project().compositions[id]!));
      await analyzer.start(id, spec, peakDbtp);
      stored = (await follow(id)) ?? undefined;
      if (!stored)
        throw new Error(state.getState().failed[id] ?? (signal.aborted ? CANCELLED : CHANGED));
    }
    if (isStale(stored, project())) throw new Error(CHANGED);
    return stored;
  }

  async function run(
    id: CompositionId,
    spec: SoundOnlySpec,
    by: MatchBy,
    signal: AbortSignal,
  ): Promise<MatchOutcome> {
    const stored = await fresh(id, spec, signal);
    const { integrated } = stored.result;
    if (integrated === null) throw new Error("The mix is silent: there is nothing to match.");
    const mix = compositionMixOf(project().compositions[id]!);
    enter(id, { step: "correcting", progress: 0 });
    const delivery = deliveryOf(mix);
    const { step } = await correct(
      spec,
      mix.master,
      delivery,
      stored.result,
      firstChange(mix.master.volumeDb, delivery.loudnessLufs, integrated),
      (progress) => enter(id, { step: "correcting", progress }),
      signal,
    );
    if (signal.aborted) throw new Error(CANCELLED);
    if (isStale(stored, project())) throw new Error(CHANGED);
    const applied = await bus.run(
      matchTarget,
      { compositionId: id, correctionDb: step.correctionDb, ceilingDb: step.ceilingDb },
      by,
    );
    if (!applied.ok) throw new Error(applied.error.message);
    enter(id, { step: "landing", progress: 0 });
    const started = await bus.run(analyzeMix, { compositionId: id }, by);
    const landed = started.ok ? await follow(id) : null;
    return { ...applied.value, correctionDb: step.correctionDb, landed: landed?.result ?? null };
  }

  return {
    start(id, spec, by) {
      if (state.getState().matching[id]) return;
      const abort = new AbortController();
      aborts.set(id, abort);
      state.setState((s) => ({
        matching: { ...s.matching, [id]: { step: "measuring", progress: 0 } },
        matchFailed: without(s.matchFailed, id),
      }));
      const done = run(id, spec, by, abort.signal).then(
        (outcome) => {
          state.setState((s) => ({ matched: { ...s.matched, [id]: outcome } }));
          return outcome;
        },
        (error: unknown) => {
          const message = messageOf(error);
          if (message !== CANCELLED) {
            log.error("Match target failed", error);
            notify("error", `Match target failed: ${message}`);
            state.setState((s) => ({ matchFailed: { ...s.matchFailed, [id]: message } }));
          }
          return null;
        },
      );
      waiting.set(id, done);
      void done.finally(() => {
        aborts.delete(id);
        waiting.delete(id);
        state.setState((s) => ({ matching: without(s.matching, id) }));
      });
    },
    async cancel(id) {
      aborts.get(id)?.abort();
      await analyzer.cancel(id);
    },
    settled: (id) => waiting.get(id) ?? Promise.resolve(null),
    async match({ project: document, compositionId, spec, onProgress, signal }) {
      const composition = document.compositions[compositionId];
      if (!composition) throw new Error("The composition to match is gone.");
      const mix = compositionMixOf(composition);
      const delivery = deliveryOf(mix);
      const before = await measureOnce(spec, delivery.peakDbtp, (p) => onProgress(p / 2), signal);
      if (before.integrated === null) {
        throw new Error("The mix is silent: there is nothing to match.");
      }
      // No fader here: the correction goes as far as it must.
      const changeDb = correctionGain(delivery.loudnessLufs - before.integrated);
      const { limiter, step } = await correct(
        spec,
        mix.master,
        delivery,
        before,
        changeDb,
        (p) => onProgress(0.5 + p / 2),
        signal,
      );
      return correctionOf(correctionGain(changeDb + step.correctionDb), limiter, step.ceilingDb);
    },
    dispose() {
      for (const abort of aborts.values()) abort.abort();
    },
  };
}
