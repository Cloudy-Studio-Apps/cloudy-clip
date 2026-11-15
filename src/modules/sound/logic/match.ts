import { TRIM_DB_MAX, TRIM_DB_MIN, type MasterMix } from "@/modules/project";
import type { LimiterPlan, SecondStep, SecondStepInput } from "../sound.delivery.types";
import { defaultSpec } from "./effects";

/**
 * The most the second step moves Master's trim, either way, in dB. Past it, more level would only push
 * the mix harder into the limiter: the limiter's ceiling would be the only thing working, so the
 * mix lands short of the target instead.
 */
export const CORRECTION_CAP_DB = 3;

/** Under this share of a dB of loudness per dB of level, the limiter is taken to give nothing back. */
const MIN_SLOPE = 0.25;

/** A dB figure to hundredths. */
const hundredths = (db: number) => Math.round(db * 100) / 100;

/** Master's trim moved by `changeDb`, kept in the trim's range, to hundredths. */
export function trimAfter(trimDb: number, changeDb: number): number {
  return hundredths(Math.min(TRIM_DB_MAX, Math.max(TRIM_DB_MIN, trimDb + changeDb)));
}

/**
 * How far Master's trim moves for `wantedDb` (here, and as an export's correction: the same
 * stage), within the trim's range.
 */
export function trimChange(trimDb: number, wantedDb: number): number {
  return hundredths(trimAfter(trimDb, wantedDb) - trimDb);
}

/**
 * The limiter matching uses: a working one on Master is the user's and stays as it is. One that
 * is off is switched on at the peak limit, keeping its release, and moved to the end of the chain
 * when it isn't last (a chain holds one of each kind): where a correction's limiter sits.
 * Otherwise a new one at the peak limit, at the end.
 */
export function limiterPlan(master: MasterMix, peakDbtp: number): LimiterPlan {
  const ceilingDb = Math.min(0, Math.max(-20, peakDbtp));
  const effects = master.effects ?? [];
  const index = effects.findIndex((effect) => effect.kind === "limiter");
  const limiter = effects[index];
  if (limiter?.kind !== "limiter") {
    return {
      own: true,
      ceilingDb,
      releaseMs: defaultSpec("limiter").releaseMs,
      switchOn: null,
      toEnd: false,
    };
  }
  if (limiter.on) return { own: false, ceilingDb: limiter.ceilingDb };
  const toEnd = index !== effects.length - 1;
  return { own: true, ceilingDb, releaseMs: limiter.releaseMs, switchOn: limiter.id, toEnd };
}

/**
 * The second step, from the mix measured with the first step and the limiter: what is still
 * missing, as level, and where the limiter's ceiling goes. A limiter lowers loudness a little,
 * more the harder it works, so the level is worked out from how much loudness the limiter gave
 * back over the first step (the share of the level over its ceiling it took), and capped
 * (`CORRECTION_CAP_DB`). The limiter listens for true peaks, but its gain changes from one
 * sample to the next, so a hard-driven mix can still pass its ceiling by a few hundredths of a
 * dB: when the mix went over the peak limit and the limiter is matching's own, its ceiling comes
 * down by as much and a tenth more (as the analysis reads a tenth of a dB), a safety margin.
 */
export function secondStep({
  before,
  after,
  changeDb,
  targetLufs,
  peakDbtp,
  limiter,
}: SecondStepInput): SecondStep {
  let ceilingDb = limiter.ceilingDb;
  if (limiter.own && after.truePeak !== null && after.truePeak > peakDbtp) {
    ceilingDb = Math.max(
      -20,
      Math.floor((ceilingDb - (after.truePeak - peakDbtp) - 0.1) * 10) / 10,
    );
  }
  if (after.integrated === null || before.integrated === null)
    return { correctionDb: 0, ceilingDb };
  const missing = targetLufs - after.integrated;
  if (missing <= 0)
    return { correctionDb: hundredths(Math.max(-CORRECTION_CAP_DB, missing)), ceilingDb };
  const over = (before.truePeak ?? -Infinity) + changeDb - limiter.ceilingDb;
  const lost = changeDb - (after.integrated - before.integrated);
  const slope = over > 0 && lost > 0 ? Math.max(MIN_SLOPE, 1 - lost / over) : 1;
  return { correctionDb: hundredths(Math.min(CORRECTION_CAP_DB, missing / slope)), ceilingDb };
}
