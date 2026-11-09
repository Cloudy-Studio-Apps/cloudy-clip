import type { GpuPass } from "../gpu/gpu.types";

/**
 * Puts groups of passes one after another, for one `run`: in each group, input -1 becomes the
 * last output before the group (the source for the first) and n its own pass n. A group of no
 * passes changes nothing.
 */
export function chainPasses(groups: readonly (readonly GpuPass[])[]): readonly GpuPass[] {
  const filled = groups.filter((group) => group.length > 0);
  if (filled.length === 1) return filled[0]!;
  const chained: GpuPass[] = [];
  for (const group of filled) {
    const base = chained.length;
    for (const pass of group) {
      const inputs = pass.inputs.map((input) => (input < 0 ? base - 1 : input + base));
      chained.push({ ...pass, inputs });
    }
  }
  return chained;
}
