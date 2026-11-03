import type { LoudnessHistogram } from "../preview.types";

/** Bins per LU, from `FLOOR` up: a hundredth of an LU is finer than any reading is shown. */
const PER_LU = 100;
/** The absolute gate of BS.1770-4 and EBU Tech 3342, in LUFS. Nothing below is kept. */
export const ABSOLUTE_GATE = -70;
const CEILING = 50;
const BINS = (CEILING - ABSOLUTE_GATE) * PER_LU;

/** Loudness of a mean square sum, the K-weighted energy of both sides (BS.1770-4, eq. 2). */
export const toLoudness = (energy: number): number =>
  energy > 0 ? -0.691 + 10 * Math.log10(energy) : -Infinity;

const binOf = (loudness: number): number =>
  Math.min(BINS - 1, Math.floor((loudness - ABSOLUTE_GATE) * PER_LU));

/**
 * Every gated block, bounded in memory however long it plays: how many fell in each hundredth of
 * an LU, and the energy they carry, so a mean is exact while the gates compare bins.
 */
export function createHistogram(): LoudnessHistogram {
  const counts = new Float64Array(BINS);
  const energies = new Float64Array(BINS);

  /** The mean energy of the bins from `from` up; `0` with none. */
  const meanFrom = (from: number): number => {
    let sum = 0;
    let count = 0;
    for (let i = Math.max(0, from); i < BINS; i++) {
      sum += energies[i]!;
      count += counts[i]!;
    }
    return count > 0 ? sum / count : 0;
  };

  return {
    add(energy) {
      const loudness = toLoudness(energy);
      if (loudness < ABSOLUTE_GATE) return;
      const bin = binOf(loudness);
      counts[bin]! += 1;
      energies[bin]! += energy;
    },
    /** The mean energy above the relative gate, `relative` LU under the absolute-gated mean. */
    gatedEnergy(relative) {
      const mean = meanFrom(0);
      if (mean === 0) return 0;
      return meanFrom(binOf(toLoudness(mean) + relative));
    },
    /** The loudness below which each fraction (0..1) of the blocks above the relative gate lies. */
    percentiles(fractions, relative) {
      const mean = meanFrom(0);
      if (mean === 0) return fractions.map(() => -Infinity);
      const from = Math.max(0, binOf(toLoudness(mean) + relative));
      let gated = 0;
      for (let i = from; i < BINS; i++) gated += counts[i]!;
      const found = fractions.map(() => -Infinity);
      let seen = 0;
      for (let i = from; i < BINS; i++) {
        seen += counts[i]!;
        if (counts[i]! === 0) continue;
        for (let f = 0; f < fractions.length; f++) {
          if (found[f] === -Infinity && seen >= fractions[f]! * gated) {
            found[f] = ABSOLUTE_GATE + (i + 0.5) / PER_LU;
          }
        }
      }
      return found;
    },
    reset() {
      counts.fill(0);
      energies.fill(0);
    },
  };
}
