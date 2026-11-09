import type { GpuUniform } from "@/modules/preview";
import { SKIN_ANGLE } from "../logic/color/basics";
import { FADE_LIFT, FADE_MUTE, SPLIT_SPAN, VIGNETTE_SQUARE } from "../logic/color/creative";
import type { CorrectionParams } from "../tint.types";
import { glslFloat as f } from "./glsl.literals";

// The steps after saturation as GLSL: skin pull (`pullSkin` in `logic/color/basics.ts`), the RGB
// mixer (`logic/color/mixer.ts`) and Creative (`logic/color/creative.ts`), line for line. Part of
// the `tint.correct` program (`correct.glsl.ts`). The vignette reads `v_uv`, the clip's own picture
// (0 left / bottom to 1 right / top), as `PixelAt` has it.

/** The uniforms and the functions `pullSkin`, `mixer`, `tone`, `vignette`. Needs `LUMA`, `PI`, `skinWeight`, `fromYcc`. */
export const TAIL_GLSL = `
uniform float u_skinPull;
uniform float u_mixerOn;
uniform float u_mixer[9];
uniform float u_splitOn;
uniform vec3 u_splitShadow;
uniform vec3 u_splitHigh;
uniform float u_splitPivot;
uniform float u_fade;
uniform vec4 u_vignette;
uniform float u_aspect;

vec3 pullSkin(vec3 c) {
  vec3 ycc = toYcc(c);
  float len = length(ycc.yz);
  float w = skinWeight(ycc.y, ycc.z, len);
  if (w <= 0.0) return c;
  float away = atan(ycc.z, ycc.y) - ${f(SKIN_ANGLE)};
  if (away < -PI) away += 2.0 * PI;
  float t = -away * u_skinPull * w;
  return fromYcc(ycc.x, cos(t) * ycc.y - sin(t) * ycc.z, sin(t) * ycc.y + cos(t) * ycc.z);
}

vec3 mixer(vec3 c) {
  vec3 o = vec3(
    u_mixer[0] * c.r + u_mixer[1] * c.g + u_mixer[2] * c.b,
    u_mixer[3] * c.r + u_mixer[4] * c.g + u_mixer[5] * c.b,
    u_mixer[6] * c.r + u_mixer[7] * c.g + u_mixer[8] * c.b
  );
  return u_mixerOn > 1.5 ? vec3(dot(o, LUMA)) : o;
}

vec3 tone(vec3 c) {
  if (u_splitOn > 0.0) {
    float h = smoothstep(u_splitPivot - ${f(SPLIT_SPAN)}, u_splitPivot + ${f(SPLIT_SPAN)}, dot(c, LUMA));
    c = c + (1.0 - h) * u_splitShadow + h * u_splitHigh;
  }
  if (u_fade > 0.0) {
    float y = dot(c, LUMA);
    vec3 v = y + (c - y) * (1.0 - ${f(FADE_MUTE)} * u_fade);
    vec3 dark = 1.0 - clamp(v, 0.0, 1.0);
    c = v + ${f(FADE_LIFT)} * u_fade * dark * dark;
  }
  return c;
}

float vignetteWeight() {
  float rnd = max(u_vignette.w, 0.0);
  float fit = min(u_aspect, 1.0);
  float sx = 1.0 + (u_aspect / fit - 1.0) * rnd;
  float sy = 1.0 + (1.0 / fit - 1.0) * rnd;
  float n = 2.0 + max(-u_vignette.w, 0.0) * ${f(VIGNETTE_SQUARE)};
  float qx = abs((v_uv.x - 0.5) * 2.0 * sx);
  float qy = abs((v_uv.y - 0.5) * 2.0 * sy);
  float d = pow(pow(qx, n) + pow(qy, n), 1.0 / n);
  return smoothstep(u_vignette.y - u_vignette.z * 0.5, u_vignette.y + u_vignette.z * 0.5, d);
}

vec3 vignette(vec3 c) {
  float a = u_vignette.x * vignetteWeight();
  return u_vignette.x < 0.0 ? c * (1.0 + a) : c + (1.0 - c) * a;
}
`;

/** The uniforms of `TAIL_GLSL`, every one set; `aspect` is the picture's width over its height. */
export function tailUniforms(p: CorrectionParams, aspect: number): Record<string, GpuUniform> {
  const v = p.vignette;
  return {
    u_skinPull: p.skinPull,
    u_mixerOn: p.mixer ? (p.mixer.mono ? 2 : 1) : 0,
    u_mixer: p.mixer?.matrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1],
    u_splitOn: p.split ? 1 : 0,
    u_splitShadow: p.split?.shadow ?? [0, 0, 0],
    u_splitHigh: p.split?.highlight ?? [0, 0, 0],
    u_splitPivot: p.split?.pivot ?? 0.5,
    u_fade: p.fade,
    u_vignette: v ? [v.amount, v.center, v.width, v.round] : [0, 1, 1, 0],
    u_aspect: aspect,
  };
}
