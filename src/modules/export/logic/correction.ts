import type { MasterCorrection, SoundMix } from "../export.types";

/**
 * A copy of `spec` whose master carries `correction`: what matching the delivery target adds to
 * one export or analysis. The spec given, and the document it was built from, are left as they
 * are; stems are taken before the master, so they never get it.
 */
export function withCorrection<S extends { mix: SoundMix }>(
  spec: S,
  correction: MasterCorrection,
): S {
  return { ...spec, mix: { ...spec.mix, master: { ...spec.mix.master, correction } } };
}
