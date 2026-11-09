import { VOLUME_DB_MAX, VOLUME_DB_MIN, type MasterMix } from "@/modules/project";
import type { LimiterPlan, SecondStep, SecondStepInput } from "../sound.types";
import { defaultSpec } from "./effects";

/**
 * The most the second step moves Master, either way, in dB. Past it, more level would only push
 * the mix harder into the limiter: the limiter's ceiling would be the only thing working, so the
 * mix lands short of the target instead.
 */
export const CORRECTION_CAP_DB = 3;

/** Under this share of a dB of loudness per dB of level, the limiter is taken to give nothing back. */
const MIN_SLOPE = 0.25;

/** A dB figure to hundredths. */
const hundredths = (db: number) => Math.round(db * 100) / 100;

/** The most a correction of an export moves its master, dB, either way (as `export` takes it). */
const CORRECTION_MAX_DB = 72;

/**
 * The level a correction of one export adds, to hundredths: with no fader to move, as far as it
 * must, within what a correction takes.
 */
export function correctionGain(changeDb: number): number {
  return hundredths(Math.min(CORRECTION_MAX_DB, Math.max(-CORRECTION_MAX_DB, changeDb)));
}

/** Master's fader moved by `changeDb`, kept in the fader's range, to hundredths. */
export function faderAfter(volumeDb: number, changeDb: number): number {
  return hundredths(Math.min(VOLUME_DB_MAX, Math.max(VOLUME_DB_MIN, volumeDb + changeDb)));
}

/** The first step: how far Master moves for the gap between the target and what was measured. */
export function firstChange(volumeDb: number, targetLufs: number, integrated: number): number {
  return hundredths(faderAfter(volumeDb, targetLufs - integrated) - volumeDb);
}

/**
 * The limiter matching uses: a working one on Master is the user's and stays as it is; one that is
 * off is switched on at the peak limit, keeping its release; with none, a new one at the peak
 * limit.
 */
export function limiterPlan(master: MasterMix, peakDbtp: number): LimiterPlan {
  const ceilingDb = Math.min(0, Math.max(-20, peakDbtp));
  const limiter = master.effects?.find((effect) => effect.kind === "limiter");
  if (limiter?.on) return { own: false, ceilingDb: limiter.ceilingDb };
  const releaseMs = limiter?.releaseMs ?? defaultSpec("limiter").releaseMs;
  return { own: true, ceilingDb, releaseMs };
}

/**
 * The second step, from the mix measured with the first step and the limiter: what is still
 * missing, as level, and where the limiter's ceiling goes. A limiter lowers loudness a little,
 * more the harder it works, so the level is worked out from how much loudness the limiter gave
 * back over the first step (the share of the level over its ceiling it took), and capped
 * (`CORRECTION_CAP_DB`). The limiter (sample peaks) can let a true peak over its ceiling; when the
 * mix went over the peak limit and the limiter is matching's own, its ceiling comes down by as
 * much and a tenth more (as the analysis reads a tenth of a dB).
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
