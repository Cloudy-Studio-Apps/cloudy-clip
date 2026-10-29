function hashString(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** A deterministic random generator in [0, 1) (mulberry32 over a string hash). */
export function seededRandom(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One threshold in [0, 1) per block of a `width` x `height` area, row by row. */
export function blockMask(
  width: number,
  height: number,
  block: number,
  seed: string,
): Float32Array {
  const size = Math.max(1, block);
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const random = seededRandom(seed);
  const out = new Float32Array(cols * rows);
  for (let i = 0; i < out.length; i++) out[i] = random();
  return out;
}
