import type { GpuTexture } from "@/modules/preview";
import { CURVE_ROWS, CURVE_SAMPLES, curvesActive, sampleCurves } from "../logic/color/curves.apply";
import type { BakedCurves, CurveTextures } from "../tint.types";

/** How many corrections' curves one filter keeps baked; the oldest goes first. */
const KEPT = 64;

/** A 53-bit hash of a text (cyrb53): the version of curves baked from it. */
function hash(text: string): number {
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
 * Curve textures for one picture filter (one per kernel, like the filter): each correction's
 * curves are sampled and baked again only when its points change. The `version` is a hash of the
 * points, so it changes with them whichever filter baked them (renderers share runners' keys by
 * node). Curves that change nothing bake to null.
 */
export function createCurveTextures(): CurveTextures {
  const held = new Map<string, { points: string; baked: BakedCurves }>();
  return {
    bake(curves, key) {
      const active = curvesActive(curves);
      if (!active.rgb && !active.hue) return null;
      const points = JSON.stringify(curves);
      const kept = held.get(key);
      if (kept?.points === points) return kept.baked;
      const table = sampleCurves(curves);
      const baked = { table, texture: bakeCurves(table, key, hash(points)) };
      held.delete(key);
      held.set(key, { points, baked });
      if (held.size > KEPT) held.delete(held.keys().next().value!);
      return baked;
    },
  };
}
