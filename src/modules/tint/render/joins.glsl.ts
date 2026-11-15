import type { GpuPass, GpuUniform } from "@/modules/preview";
import { BLEND_GLSL, gpuInt } from "@/modules/preview";
import { BLEND_MODES, type BlendMode, type KeyJoin } from "@/modules/project";
import type { LimitParams } from "../tint.types";
import { FINISH_WITH_GLSL } from "./limit.glsl";

// Groups put back together as GLSL, line for line with `logic/color/joins.ts` (formulas there).
// A join pass reads the picture its branches start from as `u_in0` and each branch after it; the
// program depends on the number of branches, so it is in the key.

const reads = (n: number) => Array.from({ length: n }, (_, i) => `texture(u_in${i + 1}, v_uv).rgb`);

const parallelFragment = (n: number) => `
uniform float u_opacity;

void main() {
  vec4 e = texture(u_in0, v_uv);
  vec3 d = vec3(0.0);
${reads(n)
  .map((branch) => `  d += ${branch} - e.rgb;`)
  .join("\n")}
  o = vec4(e.rgb + u_opacity * d, e.a);
}`;

const layerFragment = (n: number) => `
${BLEND_GLSL}
uniform float u_opacity;
${Array.from({ length: n }, (_, i) => `uniform int u_blend${i};`).join("\n")}

vec3 layered(int mode, vec3 base, vec3 top) {
  return mode == 0 ? top : blend(mode, clamp(base, 0.0, 1.0), clamp(top, 0.0, 1.0));
}

void main() {
  vec4 e = texture(u_in0, v_uv);
  vec3 c = e.rgb;
${reads(n)
  .map((branch, i) => `  c = layered(u_blend${i}, c, ${branch});`)
  .join("\n")}
  o = vec4(mix(e.rgb, c, u_opacity), e.a);
}`;

const CHANNEL_FRAGMENT = `
uniform vec3 u_pick;

void main() {
  vec4 c = texture(u_in0, v_uv);
  o = vec4(vec3(dot(c.rgb, u_pick)), c.a);
}`;

const JOIN_FRAGMENT = `
void main() {
  vec4 r = texture(u_in0, v_uv);
  o = vec4(r.r, texture(u_in1, v_uv).g, texture(u_in2, v_uv).b, r.a);
}`;

const keyJoinFragment = (n: number) => `
${FINISH_WITH_GLSL}
${Array.from(
  { length: n },
  (_, i) => `uniform vec3 u_finish${i};
uniform int u_mode${i};`,
).join("\n")}

float entry(float k, vec3 f) { return f.z > 0.0 ? 1.0 : finishWith(k, f.x, f.y); }

void main() {
  float k = entry(texture(u_in0, v_uv).r, u_finish0);
  float x;
${Array.from(
  { length: n - 1 },
  (_, j) => `  x = entry(texture(u_in${j + 1}, v_uv).r, u_finish${j + 1});
  k = u_mode${j + 1} == 0 ? k + x - k * x : u_mode${j + 1} == 1 ? k * (1.0 - x) : k * x;`,
).join("\n")}
  o = vec4(k, k, k, 1.0);
}`;

/** The modes of a key join, as the shader numbers them. */
const KEY_MODES: KeyJoin["keys"][number]["mode"][] = ["add", "subtract", "intersect"];

const COPY_FRAGMENT = `
void main() {
  o = texture(u_in0, v_uv);
}`;

/** Side by side over `entry`: each branch's change from it added, times `opacity`. */
export function parallelPass(entry: number, branches: readonly number[], opacity: number): GpuPass {
  const n = branches.length;
  return {
    key: `tint.join.parallel.${n}`,
    fragment: parallelFragment(n),
    inputs: [entry, ...branches],
    uniforms: { u_opacity: opacity },
  };
}

/** Stacked over `entry`: each branch over the picture so far by its blend (`BLEND_GLSL`), mixed by `opacity`. */
export function layerPass(
  entry: number,
  branches: readonly number[],
  blends: readonly BlendMode[],
  opacity: number,
): GpuPass {
  const n = branches.length;
  const uniforms: Record<string, GpuUniform> = { u_opacity: opacity };
  branches.forEach((_, i) => {
    uniforms[`u_blend${i}`] = gpuInt(Math.max(BLEND_MODES.indexOf(blends[i] ?? "normal"), 0));
  });
  return {
    key: `tint.join.layer.${n}`,
    fragment: layerFragment(n),
    inputs: [entry, ...branches],
    uniforms,
  };
}

/** One channel of `input` as gray: what a branch of a per-channel group reads. */
export function channelPass(input: number, channel: "r" | "g" | "b"): GpuPass {
  return {
    key: "tint.join.channel",
    fragment: CHANNEL_FRAGMENT,
    inputs: [input],
    uniforms: {
      u_pick: [channel === "r" ? 1 : 0, channel === "g" ? 1 : 0, channel === "b" ? 1 : 0],
    },
  };
}

/** Per channel put back together: red of `r`, green of `g`, blue of `b`, the alpha of `r`. */
export function joinPass(r: number, g: number, b: number): GpuPass {
  return { key: "tint.join.channels", fragment: JOIN_FRAGMENT, inputs: [r, g, b] };
}

/**
 * A key join: each entry's key pass (null: limits nothing, 1) finished by its params, the first as
 * it is and each next combined by its mode (`logic/color/joins.ts` `keyJoinValue`). Writes the
 * finished key in every channel.
 */
export function keyJoinPass(
  keys: readonly {
    key: { key: number; params: LimitParams } | null;
    mode: KeyJoin["keys"][number]["mode"];
  }[],
): GpuPass {
  const uniforms: Record<string, GpuUniform> = {};
  keys.forEach(({ key, mode }, i) => {
    uniforms[`u_finish${i}`] = key ? [key.params.clean, key.params.invert ? 1 : 0, 0] : [0, 0, 1];
    uniforms[`u_mode${i}`] = gpuInt(KEY_MODES.indexOf(mode));
  });
  return {
    key: `tint.join.keys.${keys.length}`,
    fragment: keyJoinFragment(keys.length),
    inputs: keys.map(({ key }) => key?.key ?? -1),
    uniforms,
  };
}

/** `input` as it is, so the result is the last pass. */
export function copyPass(input: number): GpuPass {
  return { key: "tint.copy", fragment: COPY_FRAGMENT, inputs: [input] };
}
