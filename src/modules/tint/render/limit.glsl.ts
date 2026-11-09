import type { GpuPass, GpuUniform } from "@/modules/preview";
import { CB, CHROMA_FULL, CR, HUE_ZERO, LUMA, NO_HUE } from "../logic/color/basics";
import type { LimitParams } from "../tint.types";
import { glslFloat as f, glslVec3 as vec3 } from "./glsl.literals";

// A limit as GLSL, line for line with `logic/color/limit.ts`: the key pass writes the raw key
// (in every channel), blur passes soften it (refine softness), and whoever reads it (the limited
// correction, or Show) cleans it up and inverts it with `FINISH_GLSL`.

const KEY_FRAGMENT = `
uniform float u_colorOn;
uniform vec3 u_hue;
uniform vec3 u_sat;
uniform vec3 u_lum;
uniform float u_brightOn;
uniform vec3 u_bright;

const vec3 LUMA = ${vec3(LUMA)};
const float PI = 3.141592653589793;

float rise(float x, float a, float e) { return e > 0.0 ? smoothstep(a - e, a, x) : step(a, x); }
float fall(float x, float b, float e) { return e > 0.0 ? 1.0 - smoothstep(b, b + e, x) : step(x, b); }
float inWindow(float x, vec3 w) { return rise(x, w.x, w.z) * fall(x, w.y, w.z); }

void main() {
  vec3 c = texture(u_in0, v_uv).rgb;
  float y = dot(c, LUMA);
  float lum = clamp(y, 0.0, 1.0);
  float k = 1.0;
  if (u_colorOn > 0.0) {
    float cb = (c.b - y) / ${f(CB)};
    float cr = (c.r - y) / ${f(CR)};
    float len = length(vec2(cb, cr));
    if (len > ${f(NO_HUE)}) {
      float turn = (atan(cr, cb) - ${f(HUE_ZERO)}) / (2.0 * PI);
      float d = turn - floor(turn) - u_hue.x;
      d -= floor(d + 0.5);
      k *= fall(abs(d), u_hue.y, u_hue.z);
    }
    k *= inWindow(min(len / ${f(CHROMA_FULL)}, 1.0), u_sat);
    k *= inWindow(lum, u_lum);
  }
  if (u_brightOn > 0.0) k *= inWindow(lum, u_bright);
  o = vec4(k, k, k, 1.0);
}`;

/** Taps either side of the middle in one blur pass. */
const TAPS = 12;
/** Gaussian weights of the taps, the radius at two sigmas, summing to 1 over both sides. */
const WEIGHTS = (() => {
  const raw = Array.from({ length: TAPS + 1 }, (_, i) => Math.exp(-0.5 * ((2 * i) / TAPS) ** 2));
  const sum = raw.reduce((total, w, i) => total + (i === 0 ? w : 2 * w), 0);
  return raw.map((w) => w / sum);
})();

const BLUR_FRAGMENT = `
uniform vec2 u_step;
const float W[${TAPS + 1}] = float[${TAPS + 1}](${WEIGHTS.map(f).join(", ")});

void main() {
  float k = W[0] * texture(u_in0, v_uv).r;
  for (int i = 1; i <= ${TAPS}; i++) {
    vec2 d = u_step * float(i);
    k += W[i] * (texture(u_in0, v_uv + d).r + texture(u_in0, v_uv - d).r);
  }
  o = vec4(k, k, k, 1.0);
}`;

/** Clean up and invert: the uniforms and `float finish(float k)`. */
export const FINISH_GLSL = `
uniform float u_clean;
uniform float u_invert;

float finish(float k) {
  if (u_clean > 0.0) k = clamp((k - u_clean) / (1.0 - 2.0 * u_clean), 0.0, 1.0);
  return u_invert > 0.0 ? 1.0 - k : k;
}
`;

/** The uniforms of `FINISH_GLSL`. */
export function finishUniforms(
  p: Pick<LimitParams, "clean" | "invert">,
): Record<string, GpuUniform> {
  return { u_clean: p.clean, u_invert: p.invert ? 1 : 0 };
}

const SHOW_FRAGMENT = `
${FINISH_GLSL}
uniform float u_whole;

void main() {
  float k = u_whole > 0.0 ? 1.0 : finish(texture(u_in1, v_uv).r);
  o = vec4(k, k, k, texture(u_in0, v_uv).a);
}`;

/**
 * The passes of a limit's key over `input`: the key, then a horizontal and a vertical blur when
 * refine softness blurs it. `aspect` is the picture's width over its height (the blur's radius is a
 * share of the height). The key is the last pass's output.
 */
export function keyPasses(p: LimitParams, input: number, first: number, aspect: number): GpuPass[] {
  const none = [0, 1, 0];
  const passes: GpuPass[] = [
    {
      key: "tint.limit.key",
      fragment: KEY_FRAGMENT,
      inputs: [input],
      uniforms: {
        u_colorOn: p.hue ? 1 : 0,
        u_hue: p.hue ?? none,
        u_sat: p.sat,
        u_lum: p.lum,
        u_brightOn: p.bright ? 1 : 0,
        u_bright: p.bright ?? none,
      },
    },
  ];
  if (p.radius > 0) {
    const step = p.radius / TAPS;
    for (const along of [
      [step / aspect, 0],
      [0, step],
    ]) {
      passes.push({
        key: "tint.limit.blur",
        fragment: BLUR_FRAGMENT,
        inputs: [first + passes.length - 1],
        uniforms: { u_step: along },
      });
    }
  }
  return passes;
}

/**
 * Show (Limit's): the key read from pass `key` as white on black, cleaned up and inverted, keeping
 * the alpha of `input`. Without a limit (`p` null) it is all white: the correction changes it all.
 */
export function showPass(p: LimitParams | null, input: number, key: number): GpuPass {
  return {
    key: "tint.limit.show",
    fragment: SHOW_FRAGMENT,
    inputs: [input, p ? key : input],
    uniforms: { ...finishUniforms(p ?? { clean: 0, invert: false }), u_whole: p ? 0 : 1 },
  };
}
