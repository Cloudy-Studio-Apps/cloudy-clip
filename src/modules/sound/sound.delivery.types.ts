import type { StoreApi } from "zustand/vanilla";
import type { ActorId, CommandBus, CommandOrigin, Logger, Micros } from "@/core";
import type { CompositionId, DeliverySettings, ProjectState, StandardId } from "@/modules/project";
import type { LoudnessMatcher, SoundOnlySpec } from "@/modules/export";

/** A delivery standard: a platform's or a broadcaster's loudness target and peak limit. */
export interface Standard {
  id: StandardId;
  name: string;
  /** Integrated loudness to reach, LUFS. */
  loudnessLufs: number;
  /** Highest true peak, dBTP. */
  peakDbtp: number;
  /** Whether the owner publishes these figures; false means a common convention. */
  published: boolean;
  /** The page the figures come from; null when none publishes them. */
  source: string | null;
}

/** A stretch of a mix that breaks the peak limit or clips (mirrors `Problem` in Rust). */
export interface MixProblem {
  /** Microseconds from the start of the mix. */
  at: Micros;
  duration: Micros;
  kind: "peak" | "clipped";
  /** The highest level in it, dBTP (peak) or dBFS (clipped). */
  level: number;
}

/** What measuring a whole mix found (mirrors `Analysis` in Rust). */
export interface MixAnalysis {
  /** LUFS; null when nothing is above the gate (a silent mix). */
  integrated: number | null;
  /** LU. */
  range: number;
  /** dBTP; null for digital silence. */
  truePeak: number | null;
  problems: MixProblem[];
}

/**
 * The limiter Match target works with (see `limiterPlan`): matching's own (added, or switched on),
 * whose ceiling it sets, at the peak limit; or the user's working one, left as it is.
 */
export type LimiterPlan =
  | {
      own: true;
      ceilingDb: number;
      releaseMs: number;
      /** The id of the off limiter on Master that is switched on; null: a new one is added. */
      switchOn: string | null;
      /** The off limiter isn't last: it moves to the end, where a correction's limiter sits. */
      toEnd: boolean;
    }
  | { own: false; ceilingDb: number };

/** What Match target needs from the rest of the module. */
export interface MatcherDeps {
  analyzer: Analyzer;
  bus: CommandBus;
  project: () => ProjectState;
  log: Logger;
}

/** What the second step of Match target is worked out from (see `secondStep`). */
export interface SecondStepInput {
  /** The mix as it is. */
  before: MixAnalysis;
  /** The mix measured with the first step and the limiter. */
  after: MixAnalysis;
  /** The first step: how far Master moved, dB. */
  changeDb: number;
  targetLufs: number;
  peakDbtp: number;
  limiter: LimiterPlan;
}

/** The second step of Match target. */
export interface SecondStep {
  /** Level added on top of the first step, dB. */
  correctionDb: number;
  /** Where the limiter's ceiling goes, dB (the user's own limiter's, unchanged). */
  ceilingDb: number;
}

/** Where Match target is, for a composition. */
export interface MatchRun {
  /**
   * `measuring`: the analysis it starts from (none fresh was there); `correcting`: the mix
   * measured again with the change, on the side; `landing`: the analysis of where it landed.
   */
  step: "measuring" | "correcting" | "landing";
  /** 0 to 1 of the step. */
  progress: number;
}

/** What Match target did (`sound.matchTarget`'s result) and where the mix landed. */
export interface MatchOutcome {
  /** Master's input trim after it. */
  trimDb: number;
  changeDb: number;
  limiterAdded: boolean;
  /** A limiter of Master's that was off was switched on, at the peak limit. */
  limiterSwitched: boolean;
  /** That limiter wasn't last in Master's chain and was moved to its end. */
  limiterMoved: boolean;
  /** The trim's range kept the mix from the target. */
  clamped: boolean;
  /** The second step's share of `changeDb`. */
  correctionDb: number;
  /** The analysis after it; null when it couldn't be made (it says why in `failed`). */
  landed: MixAnalysis | null;
  /**
   * The last measured true peak (`landed`) is still over the peak limit: by how much, dB, and
   * whether that's because Master's limiter is the user's own with its ceiling above the limit
   * (false: the limiter's ceiling is at or under it, and peaks between samples got past it). Null
   * when it is under, or
   * nothing was measured after. Matching does not measure a third time.
   */
  peakOver: { overDb: number; userLimiter: boolean } | null;
}

/** An analysis kept with the document it measured. */
export interface StoredAnalysis {
  result: MixAnalysis;
  /** The project as it was measured; any other state is a later edit. */
  measured: ProjectState;
  /** The peak limit it looked for, dBTP. */
  peakDbtp: number;
  /** When it ended, ms since the epoch: what the panel says it measured. */
  at: number;
}

/** An analysis under way. */
export interface RunningAnalysis {
  /** Null while the job is starting. */
  jobId: string | null;
  /** 0 to 1. */
  progress: number;
  /** The project this analysis measures; a later state makes it stale before it ends. */
  measured: ProjectState;
}

/** Analyses of whole mixes per composition, and those running. View state, never in history. */
export interface AnalysisState {
  results: Record<CompositionId, StoredAnalysis>;
  running: Record<CompositionId, RunningAnalysis>;
  /** Why the last analysis of a composition failed. */
  failed: Record<CompositionId, string>;
  /** Match target running, per composition. */
  matching: Record<CompositionId, MatchRun>;
  /** The last Match target that ended, per composition. */
  matched: Record<CompositionId, MatchOutcome>;
  /** Why the last Match target of a composition failed. */
  matchFailed: Record<CompositionId, string>;
}

/** Runs analyses of whole mixes outside the bus, which times out after 30 s. */
export interface Analyzer {
  state: StoreApi<AnalysisState>;
  /**
   * Starts measuring (see `sound.analyzeMix`); rejects if the mix has no sound. Returns at once.
   * `measured` is the project `spec` was built from (default: the project now); the result is
   * labelled with it, never with a later one.
   */
  start(
    compositionId: CompositionId,
    spec: SoundOnlySpec,
    peakDbtp: number,
    measured?: ProjectState,
  ): Promise<void>;
  /** Stops the analysis of a composition. */
  cancel(compositionId: CompositionId): Promise<void>;
  /** Resolves when the analysis running for the composition ends; the stored result, or null (failed or cancelled). */
  settled(compositionId: CompositionId): Promise<StoredAnalysis | null>;
  /** Stops every running analysis (the kernel is going away). */
  dispose(): void;
}

/** Who asked for a Match target: its change is theirs, in their undo history. */
export interface MatchBy {
  origin: CommandOrigin;
  actor: ActorId;
}

/** Runs Match target outside the bus (see `sound.startMatch`), in the analyses' store. */
export interface Matcher {
  /**
   * Starts matching the composition whose mix `spec` is (built from the document as it is now),
   * returning at once. Its one change to the project is `sound.matchTarget`, run as `by`.
   */
  start(compositionId: CompositionId, spec: SoundOnlySpec, by: MatchBy): void;
  /** Stops it, and its analyses. */
  cancel(compositionId: CompositionId): Promise<void>;
  /** Resolves when the Match target running for the composition ends: what it did, or null. */
  settled(compositionId: CompositionId): Promise<MatchOutcome | null>;
  /** Matches one export's mix, in its spec only (`export`'s `loudnessMatchers`). */
  match: LoudnessMatcher["match"];
  /** Stops everything running (the kernel is going away). */
  dispose(): void;
}

/** What the Deliver tab shows for the open composition. */
export interface DeliverView {
  compositionId: CompositionId | undefined;
  delivery: DeliverySettings;
  /** The last whole-mix analysis, if any. */
  stored: StoredAnalysis | undefined;
  /** The document has changed since it was measured. */
  stale: boolean;
  running: RunningAnalysis | undefined;
  failed: string | undefined;
  matching: MatchRun | undefined;
  matched: MatchOutcome | undefined;
  matchFailed: string | undefined;
}
