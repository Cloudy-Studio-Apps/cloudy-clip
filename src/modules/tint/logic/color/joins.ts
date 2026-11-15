import type { BlendMode, KeyJoin } from "@/modules/project";
import type { Rgb } from "../../tint.types";
import { blendRgb } from "./blend";

// How groups put their branches back together, the CPU side of `render/joins.glsl.ts`, line for
// line:
// - side by side: `in + opacity · Σ (branchᵢ − in)`, each branch's change added to the picture in;
// - stacked: from the picture in, each branch in input order (the first lowest, the last on top)
//   lands over the picture so far by its blend mode, then the result is mixed over the picture in
//   by opacity. Normal is the branch itself; any other mode blends the two clamped to 0…1, as the
//   modes are defined there;
// - per channel: a branch reads one channel of the picture as gray, and the join takes red from
//   the red branch, green from the green one and blue from the blue one;
// - a key join: the first key as it is, then each next one `x` by its mode: add `k + x − k·x`
//   (either), subtract `k·(1 − x)` (k but not x), intersect `k·x` (both). Each stays in 0…1.

const clamp = (c: Rgb): Rgb => c.map((v) => Math.min(Math.max(v, 0), 1)) as Rgb;

/** Side by side. */
export function parallelRgb(entry: Rgb, branches: readonly Rgb[], opacity: number): Rgb {
  const d: Rgb = [0, 0, 0];
  for (const b of branches) for (let i = 0; i < 3; i++) d[i] = d[i]! + (b[i]! - entry[i]!);
  return [entry[0] + opacity * d[0], entry[1] + opacity * d[1], entry[2] + opacity * d[2]];
}

/** Stacked. */
export function layerRgb(
  entry: Rgb,
  branches: readonly Rgb[],
  blends: readonly BlendMode[],
  opacity: number,
): Rgb {
  let c = entry;
  branches.forEach((top, i) => {
    const mode = blends[i] ?? "normal";
    c = mode === "normal" ? top : blendRgb(mode, clamp(c), clamp(top));
  });
  return [
    entry[0] + (c[0] - entry[0]) * opacity,
    entry[1] + (c[1] - entry[1]) * opacity,
    entry[2] + (c[2] - entry[2]) * opacity,
  ];
}

/** One channel as gray. */
export function channelRgb(c: Rgb, channel: "r" | "g" | "b"): Rgb {
  const v = c[channel === "r" ? 0 : channel === "g" ? 1 : 2];
  return [v, v, v];
}

/** Per channel, put back together. */
export function joinRgb(r: Rgb, g: Rgb, b: Rgb): Rgb {
  return [r[0], g[1], b[2]];
}

/** A key join's keys (finished, 0…1) combined in order; the first one's mode is not read. */
export function keyJoinValue(
  keys: readonly { k: number; mode: KeyJoin["keys"][number]["mode"] }[],
): number {
  let k = keys[0]?.k ?? 1;
  for (const { k: x, mode } of keys.slice(1)) {
    k = mode === "add" ? k + x - k * x : mode === "subtract" ? k * (1 - x) : k * x;
  }
  return k;
}
