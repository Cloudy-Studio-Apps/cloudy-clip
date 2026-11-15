import type { GpuTexture } from "@/modules/preview";
import { CURVE_ROWS, CURVE_SAMPLES } from "../logic/color/curves.apply";
import { curveStepActive, sampleCurveStep } from "../logic/color/mix";
import { WARP_TABLE, sampleWarper, warperActive } from "../logic/color/warper";
import type { BakedTable, CubeLut, GradeTextures } from "../tint.types";

/** How many corrections' tables of each kind one filter keeps baked; the oldest goes first. */
const KEPT = 64;

/** A 53-bit hash of a text (cyrb53): the version of a table baked from it. */
export function hash(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * A curve table (`sampleCurves`) as the texture the shader samples: 1024 samples by 8 rows
 * (`CURVE_ROWS`), each value in red (and copied into green and blue), half-float on the GPU. The
 * runner uploads it again only when `key` or `version` changes.
 */
export function bakeCurves(table: Float32Array, key: string, version: number): GpuTexture {
  const data = new Float32Array(table.length * 4);
  for (let i = 0; i < table.length; i++) {
    const v = table[i]!;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 1;
  }
  return { key, version, kind: "2d", width: CURVE_SAMPLES, height: CURVE_ROWS.length, data };
}

/**
 * A warp table (`sampleWarper`) as the texture the shader samples: 180 hues by 32 strengths
 * (`WARP_TABLE`), the hue offset in red and the strength offset in green, half-float on the GPU.
 */
export function bakeWarper(table: Float32Array, key: string, version: number): GpuTexture {
  const { width, height } = WARP_TABLE;
  const data = new Float32Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = table[i * 2]!;
    data[i * 4 + 1] = table[i * 2 + 1]!;
    data[i * 4 + 3] = 1;
  }
  return { key, version, kind: "2d", width, height, data };
}

/**
 * A LUT as the texture the shader samples, half-float RGBA: a 3D one as a `size`³ `"3d"` texture
 * (red along x, green along y, blue along z, as `.cube` orders it), a 1D one as a `"1d"` texture
 * `size` wide, each channel's curve in its own channel.
 */
export function bakeLut(lut: CubeLut, key: string, version: number): GpuTexture {
  const count = lut.data.length / 3;
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = lut.data[i * 3]!;
    data[i * 4 + 1] = lut.data[i * 3 + 1]!;
    data[i * 4 + 2] = lut.data[i * 3 + 2]!;
    data[i * 4 + 3] = 1;
  }
  const { size } = lut;
  return lut.kind === "3d"
    ? { key, version, kind: "3d", width: size, height: size, depth: size, data }
    : { key, version, kind: "1d", width: size, height: 1, data };
}

/** Keeps the `KEPT` most recent tables baked, by key; `make` runs only when `source` changed. */
function createCache(): (
  source: string,
  key: string,
  make: (version: number) => BakedTable,
) => BakedTable {
  const held = new Map<string, { source: string; baked: BakedTable }>();
  return (source, key, make) => {
    const kept = held.get(key);
    if (kept?.source === source) return kept.baked;
    const baked = make(hash(source));
    held.delete(key);
    held.set(key, { source, baked });
    if (held.size > KEPT) held.delete(held.keys().next().value!);
    return baked;
  };
}

/**
 * The lookup tables of one picture filter (one per kernel, like the filter): each correction's curve
 * step (curves and Color mix) and warper are sampled and baked again only when they change, and each
 * LUT only when its file does. The `version` is a hash of what they are made of, so it changes with
 * them whichever filter baked them (renderers share runners' keys by node). What changes nothing
 * bakes to null.
 */
export function createGradeTextures(): GradeTextures {
  const curves = createCache();
  const warpers = createCache();
  const luts = createCache();
  return {
    curves(values, key) {
      const active = curveStepActive(values);
      if (!active.rgb && !active.hue) return null;
      return curves(JSON.stringify([values.curves, values.mix]), key, (version) => {
        const table = sampleCurveStep(values);
        return { table, texture: bakeCurves(table, key, version) };
      });
    },
    warper(warper, key) {
      if (!warperActive(warper)) return null;
      return warpers(JSON.stringify(warper), key, (version) => {
        const table = sampleWarper(warper);
        return { table, texture: bakeWarper(table, key, version) };
      });
    },
    lut({ table, version }, key) {
      // The file's own hash is the source: the table is never turned into text again.
      return luts(String(version), key, (v) => ({
        table: table.data,
        texture: bakeLut(table, key, v),
      })).texture;
    },
  };
}
