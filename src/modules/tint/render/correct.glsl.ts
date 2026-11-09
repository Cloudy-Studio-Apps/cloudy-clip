import type { GpuPass, GpuTexture, GpuUniform } from "@/modules/preview";
import {
  BANDS,
  CB,
  CHROMA_FULL,
  CR,
  HUE_ZERO,
  LOG_K,
  LOG_SCALE,
  LOG_SLOPE,
  LUMA,
  NO_HUE,
  REC709,
  SKIN_ANGLE,
  SKIN_CHROMA,
  SKIN_FAR,
  SKIN_NEAR,
} from "../logic/color/basics";
import { CURVE_ROWS, CURVE_SAMPLES, ROW } from "../logic/color/curves.apply";
import { WARP_TABLE } from "../logic/color/warper";
import type { CorrectionParams } from "../tint.types";

// One correction as GLSL: the same math as `logic/color/correct.ts`, line for line, with every
// constant written in from `logic/color/basics.ts`. What depends on the values comes in as
// uniforms worked out by `prepareCorrection`.

/** A number as a GLSL float literal. */
const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const vec3 = (v: readonly number[]): string => `vec3(${v.map(f).join(", ")})`;
const bands = BANDS.map((b) => `vec4(${b.map(f).join(", ")})`).join(", ");

const FRAGMENT = `
uniform vec3 u_linear;
uniform vec3 u_lift;
uniform vec3 u_gammaInv;
uniform vec3 u_gain;
uniform vec3 u_offset;
uniform float u_contrast;
uniform float u_pivot;
uniform vec4 u_bands;
uniform float u_knee;
uniform float u_saturation;
uniform float u_vibrance;
uniform vec2 u_hue;
uniform float u_skin;
uniform vec2 u_curveOn;
uniform sampler2D u_curves;
uniform float u_warpOn;
uniform sampler2D u_warp;
uniform float u_opacity;

const vec3 LUMA = ${vec3(LUMA)};
const vec4 BANDS[4] = vec4[4](${bands});
const float PI = 3.141592653589793;

float toLinear(float v) {
  return v < ${f(REC709.toe)} ? v / ${f(REC709.slope)}
    : pow((v + ${f(REC709.a)}) / ${f(1 + REC709.a)}, ${f(1 / REC709.power)});
}

float toDisplay(float l) {
  return l < ${f(REC709.toe / REC709.slope)} ? ${f(REC709.slope)} * l
    : ${f(1 + REC709.a)} * pow(l, ${f(REC709.power)}) - ${f(REC709.a)};
}

float logish(float x) {
  return x < 0.0 ? x * ${f(LOG_SLOPE)} : log(1.0 + ${f(LOG_K)} * x) / ${f(LOG_SCALE)};
}

float unlogish(float y) {
  return y < 0.0 ? y / ${f(LOG_SLOPE)} : (exp(y * ${f(LOG_SCALE)}) - 1.0) / ${f(LOG_K)};
}

float primary(float x, float lift, float gammaInv, float gain, float offset) {
  float base = x + lift * (1.0 - x);
  return gain * (base > 0.0 ? pow(base, gammaInv) : base) + offset;
}

float rolloff(float x) {
  if (u_knee >= 1.0 || x <= u_knee) return x;
  float span = 1.0 - u_knee;
  return u_knee + span * (1.0 - exp(-(x - u_knee) / span));
}

float curveAt(float row, float x) {
  float u = (clamp(x, 0.0, 1.0) * ${f(CURVE_SAMPLES - 1)} + 0.5) / ${f(CURVE_SAMPLES)};
  return texture(u_curves, vec2(u, (row + 0.5) / ${f(CURVE_ROWS.length)})).r;
}

float tone(float row, float x) {
  if (x < 0.0) return curveAt(row, 0.0) + x;
  if (x > 1.0) return curveAt(row, 1.0) + x - 1.0;
  return curveAt(row, x);
}

vec3 curves(vec3 c) {
  if (u_curveOn.x > 0.0) {
    for (int i = 0; i < 3; i++) c[i] = tone(float(${ROW.r} + i), tone(${f(ROW.y)}, c[i]));
  }
  if (u_curveOn.y <= 0.0) return c;
  float y = dot(c, LUMA);
  float cb = (c.b - y) / ${f(CB)};
  float cr = (c.r - y) / ${f(CR)};
  float len = length(vec2(cb, cr));
  float k = 2.0 * curveAt(${f(ROW.lumSat)}, y);
  float lum = y;
  if (len > ${f(NO_HUE)}) {
    float turn = (atan(cr, cb) - ${f(HUE_ZERO)}) / (2.0 * PI);
    float h = turn - floor(turn);
    float a = (curveAt(${f(ROW.hueHue)}, h) - 0.5) * 2.0 * PI;
    k *= 2.0 * curveAt(${f(ROW.hueSat)}, h);
    lum = y * (1.0 + (2.0 * curveAt(${f(ROW.hueLum)}, h) - 1.0) * min(len / ${f(CHROMA_FULL)}, 1.0));
    float turnedCb = cos(a) * cb - sin(a) * cr;
    cr = sin(a) * cb + cos(a) * cr;
    cb = turnedCb;
  }
  float r = lum + ${f(CR)} * cr * k;
  float b = lum + ${f(CB)} * cb * k;
  return vec3(r, (lum - LUMA.r * r - LUMA.b * b) / LUMA.g, b);
}

vec3 warp(vec3 c) {
  float y = dot(c, LUMA);
  float cb = (c.b - y) / ${f(CB)};
  float cr = (c.r - y) / ${f(CR)};
  float len = length(vec2(cb, cr));
  if (len <= ${f(NO_HUE)}) return c;
  float s = len / ${f(CHROMA_FULL)};
  float turn = (atan(cr, cb) - ${f(HUE_ZERO)}) / (2.0 * PI);
  float h = turn - floor(turn);
  vec2 at = vec2(
    (h * ${f(WARP_TABLE.width - 1)} + 0.5) / ${f(WARP_TABLE.width)},
    (clamp(s, 0.0, 1.0) * ${f(WARP_TABLE.height - 1)} + 0.5) / ${f(WARP_TABLE.height)}
  );
  vec2 o = texture(u_warp, at).rg;
  float k = max(s + o.y, 0.0) / s;
  float a = o.x * 2.0 * PI;
  float turnedCb = (cos(a) * cb - sin(a) * cr) * k;
  cr = (sin(a) * cb + cos(a) * cr) * k;
  cb = turnedCb;
  float r = y + ${f(CR)} * cr;
  float b = y + ${f(CB)} * cb;
  return vec3(r, (y - LUMA.r * r - LUMA.b * b) / LUMA.g, b);
}

vec3 chroma(vec3 rgb) {
  float y = dot(rgb, LUMA);
  float cb = (rgb.b - y) / ${f(CB)};
  float cr = (rgb.r - y) / ${f(CR)};
  float len = length(vec2(cb, cr));
  float skin = 0.0;
  if (u_skin > 0.0 && len > ${f(NO_HUE)}) {
    float turn = abs(atan(cr, cb) - ${f(SKIN_ANGLE)});
    float away = min(turn, 2.0 * PI - turn);
    skin = (1.0 - smoothstep(${f(SKIN_NEAR)}, ${f(SKIN_FAR)}, away))
      * smoothstep(${f(SKIN_CHROMA[0])}, ${f(SKIN_CHROMA[1])}, len);
  }
  float c = min(len / ${f(CHROMA_FULL)}, 1.0);
  float scale = u_saturation * (1.0 + u_vibrance * (1.0 - c) * (1.0 - c));
  float k = scale + (1.0 - scale) * skin;
  float turnedCb = u_hue.x * cb - u_hue.y * cr;
  float turnedCr = u_hue.y * cb + u_hue.x * cr;
  float outCb = (cb + (turnedCb - cb) * (1.0 - skin)) * k;
  float outCr = (cr + (turnedCr - cr) * (1.0 - skin)) * k;
  float r = y + ${f(CR)} * outCr;
  float b = y + ${f(CB)} * outCb;
  return vec3(r, (y - LUMA.r * r - LUMA.b * b) / LUMA.g, b);
}

vec3 correct(vec3 c) {
  for (int i = 0; i < 3; i++) c[i] = toDisplay(toLinear(c[i]) * u_linear[i]);
  for (int i = 0; i < 3; i++) c[i] = primary(c[i], u_lift[i], u_gammaInv[i], u_gain[i], u_offset[i]);
  for (int i = 0; i < 3; i++) c[i] = unlogish(u_pivot + (logish(c[i]) - u_pivot) * u_contrast);
  float y = dot(c, LUMA);
  vec4 w;
  for (int i = 0; i < 4; i++) {
    vec4 e = BANDS[i];
    w[i] = smoothstep(e.x, e.y, y) * (1.0 - smoothstep(e.z, e.w, y));
  }
  float shift = dot(u_bands, w);
  for (int i = 0; i < 3; i++) c[i] = rolloff(c[i] + shift);
  if (u_curveOn.x > 0.0 || u_curveOn.y > 0.0) c = curves(c);
  if (u_warpOn > 0.0) c = warp(c);
  return chroma(c);
}

void main() {
  vec4 src = texture(u_in0, v_uv);
  o = vec4(mix(src.rgb, correct(src.rgb), u_opacity), src.a);
}`;

/** Program key of a correction pass. */
export const CORRECT_KEY = "tint.correct";

/**
 * A correction's pass over `input` (-1 the picture so far, n pass n), mixed over it by `opacity`.
 * `tables.curves` is its baked curve step (curves and Color mix) and `tables.warper` its warper,
 * each left out when it changes nothing (the shader then skips that step).
 */
export function correctPass(
  params: CorrectionParams,
  opacity: number,
  input: number,
  tables: { curves?: GpuTexture; warper?: GpuTexture } = {},
): GpuPass {
  const { curves, warper } = tables;
  const uniforms: Record<string, GpuUniform> = {
    u_linear: params.linear,
    u_lift: params.lift,
    u_gammaInv: params.gammaInv,
    u_gain: params.gain,
    u_offset: params.offset,
    u_contrast: params.contrast,
    u_pivot: params.pivot,
    u_bands: params.bands,
    u_knee: params.knee,
    u_saturation: params.saturation,
    u_vibrance: params.vibrance,
    u_hue: params.hue,
    u_skin: params.skin,
    u_curveOn: curves ? params.curveOn : [0, 0],
    u_warpOn: warper ? 1 : 0,
    u_opacity: opacity,
  };
  const textures: Record<string, GpuTexture> = {};
  if (curves) textures.u_curves = curves;
  if (warper) textures.u_warp = warper;
  const pass: GpuPass = { key: CORRECT_KEY, fragment: FRAGMENT, inputs: [input], uniforms };
  return curves || warper ? { ...pass, textures } : pass;
}
