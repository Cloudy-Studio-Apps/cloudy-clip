import type { DeliverySettings } from "@/modules/project";
import type { DeliveryVerdict } from "../sound.meter.types";
import type { MixAnalysis } from "../sound.delivery.types";

/** How an analysis stands against the delivery target and peak limit. */
export function verdictOf(analysis: MixAnalysis, delivery: DeliverySettings): DeliveryVerdict {
  return {
    loudnessDiff: analysis.integrated === null ? null : analysis.integrated - delivery.loudnessLufs,
    peakMargin: analysis.truePeak === null ? null : delivery.peakDbtp - analysis.truePeak,
  };
}

/** A loudness within this many LU of the target counts as on it (platforms read ±1). */
export const ON_TARGET_LU = 1;
