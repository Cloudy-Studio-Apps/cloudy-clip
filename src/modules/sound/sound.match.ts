import { notify } from "@/core";
import { withCorrection, type MasterCorrection, type SoundOnlySpec } from "@/modules/export";
import {
  compositionMixOf,
  type CompositionId,
  type DeliverySettings,
  type MasterMix,
  type ProjectState,
} from "@/modules/project";
import { isStale, storedFor } from "./sound.analysis.store";
import { analyzeMix, matchTarget } from "./sound.delivery.commands";
import { measureOnce } from "./sound.measure";
import { deliveryOf } from "./logic/standards";
import { limiterPlan, secondStep, trimChange } from "./logic/match";
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
} from "./sound.delivery.types";

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

  /** Cancels the analysis running for `id` and waits until it is gone: it measures an older project. */
  async function stop(id: CompositionId): Promise<void> {
    await analyzer.cancel(id);
    await new Promise<void>((resolve) => {
      if (!state.getState().running[id]) return resolve();
      const unsubscribe = state.subscribe((s) => {
        if (s.running[id]) return;
        unsubscribe();
        resolve();
      });
    });
  }

  /**
   * An analysis of `origin`, the project `spec` was built from: the stored one when it measured
   * `origin`, or a new one of `spec`. Fails with CHANGED as soon as the project isn't `origin`.
   */
  async function measured(
    id: CompositionId,
    spec: SoundOnlySpec,
    origin: ProjectState,
    signal: AbortSignal,
  ): Promise<StoredAnalysis> {
    const running = state.getState().running[id];
    if (running?.measured === origin) await follow(id);
    else if (running) await stop(id);
    if (project() !== origin) throw new Error(CHANGED);
    const stored = storedFor(state, id);
    if (stored?.measured === origin) return stored;
    const { peakDbtp } = deliveryOf(compositionMixOf(origin.compositions[id]!));
    await analyzer.start(id, spec, peakDbtp, origin);
    await follow(id);
    const result = storedFor(state, id);
    if (result?.measured === origin && project() === origin) return result;
    throw new Error(state.getState().failed[id] ?? (signal.aborted ? CANCELLED : CHANGED));
  }

  async function run(
    id: CompositionId,
    spec: SoundOnlySpec,
    origin: ProjectState,
    by: MatchBy,
    signal: AbortSignal,
  ): Promise<MatchOutcome> {
    const stored = await measured(id, spec, origin, signal);
    const { integrated } = stored.result;
    if (integrated === null) throw new Error("The mix is silent: there is nothing to match.");
    const mix = compositionMixOf(origin.compositions[id]!);
    enter(id, { step: "correcting", progress: 0 });
    const delivery = deliveryOf(mix);
    const trimDb = mix.master.trimDb ?? 0;
    const { limiter, step } = await correct(
      spec,
      mix.master,
      delivery,
      stored.result,
      trimChange(trimDb, delivery.loudnessLufs - integrated),
      (progress) => enter(id, { step: "correcting", progress }),
      signal,
    );
    if (signal.aborted) throw new Error(CANCELLED);
    // Never a change worked out from one project written into another.
    if (project() !== origin) throw new Error(CHANGED);
    const applied = await bus.run(
      matchTarget,
      { compositionId: id, correctionDb: step.correctionDb, ceilingDb: step.ceilingDb },
      by,
    );
    if (!applied.ok) throw new Error(applied.error.message);
    enter(id, { step: "landing", progress: 0 });
    const started = await bus.run(analyzeMix, { compositionId: id }, by);
    const landed = started.ok ? await follow(id) : null;
    const peak = landed?.result.truePeak ?? null;
    const peakOver =
      peak !== null && peak > delivery.peakDbtp
        ? { overDb: Math.round((peak - delivery.peakDbtp) * 10) / 10, userLimiter: !limiter.own && limiter.ceilingDb > delivery.peakDbtp }
        : null;
    return {
      ...applied.value,
      correctionDb: step.correctionDb,
      landed: landed?.result ?? null,
      peakOver,
    };
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
      // The project `spec` was just built from.
      const origin = project();
      const done = run(id, spec, origin, by, abort.signal).then(
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
      // The correction is the trim's stage, held to the trim's range, as Match target here.
      const trimDb = mix.master.trimDb ?? 0;
      const changeDb = trimChange(trimDb, delivery.loudnessLufs - before.integrated);
      const { limiter, step } = await correct(
        spec,
        mix.master,
        delivery,
        before,
        changeDb,
        (p) => onProgress(0.5 + p / 2),
        signal,
      );
      const gainDb = trimChange(trimDb, changeDb + step.correctionDb);
      return correctionOf(gainDb, limiter, step.ceilingDb);
    },
    dispose() {
      for (const abort of aborts.values()) abort.abort();
    },
  };
}
