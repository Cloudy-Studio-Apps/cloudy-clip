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
import type { CorrectionParams, LimitParams, LutKind, PassLut } from "../tint.types";
import { TAIL_GLSL, tailUniforms } from "./correct.tail.glsl";
import { WHEELS_GLSL, wheelsUniforms } from "./correct.wheels.glsl";
import { glslFloat as f, glslVec3 as vec3 } from "./glsl.literals";
import { FINISH_GLSL, finishUniforms } from "./limit.glsl";

// One correction as GLSL: the same math as `logic/color/correct.ts`, line for line, with every
// constant written in from `logic/color/`. What depends on the values comes in as uniforms worked
// out by `prepareCorrection`. The log and zone wheels are in `correct.wheels.glsl.ts`, skin pull,
// the mixer and Creative in `correct.tail.glsl.ts`.
const bands = BANDS.map((b) => `vec4(${b.map(f).join(", ")})`).join(", ");

const BODY = `
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

${WHEELS_GLSL}

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

vec3 toYcc(vec3 c) {
  float y = dot(c, LUMA);
  return vec3(y, (c.b - y) / ${f(CB)}, (c.r - y) / ${f(CR)});
}

vec3 fromYcc(float y, float cb, float cr) {
  float r = y + ${f(CR)} * cr;
  float b = y + ${f(CB)} * cb;
  return vec3(r, (y - LUMA.r * r - LUMA.b * b) / LUMA.g, b);
}

float skinWeight(float cb, float cr, float len) {
  if (len <= ${f(NO_HUE)}) return 0.0;
  float turn = abs(atan(cr, cb) - ${f(SKIN_ANGLE)});
  float away = min(turn, 2.0 * PI - turn);
  return (1.0 - smoothstep(${f(SKIN_NEAR)}, ${f(SKIN_FAR)}, away))
    * smoothstep(${f(SKIN_CHROMA[0])}, ${f(SKIN_CHROMA[1])}, len);
}

vec3 chroma(vec3 rgb) {
  float y = dot(rgb, LUMA);
  float cb = (rgb.b - y) / ${f(CB)};
  float cr = (rgb.r - y) / ${f(CR)};
  float len = length(vec2(cb, cr));
  float skin = u_skin > 0.0 ? skinWeight(cb, cr, len) : 0.0;
  float c = min(len / ${f(CHROMA_FULL)}, 1.0);
  float scale = u_saturation * (1.0 + u_vibrance * (1.0 - c) * (1.0 - c));
  float k = scale + (1.0 - scale) * skin;
  float turnedCb = u_hue.x * cb - u_hue.y * cr;
  float turnedCr = u_hue.y * cb + u_hue.x * cr;
  float outCb = (cb + (turnedCb - cb) * (1.0 - skin)) * k;
  float outCr = (cr + (turnedCr - cr) * (1.0 - skin)) * k;
  return fromYcc(y, outCb, outCr);
}
${TAIL_GLSL}

vec3 correct(vec3 c) {
  for (int i = 0; i < 3; i++) c[i] = toDisplay(toLinear(c[i]) * u_linear[i]);
  for (int i = 0; i < 3; i++) c[i] = primary(c[i], u_lift[i], u_gammaInv[i], u_gain[i], u_offset[i]);
  if (u_logOn > 0.0 || u_zonesOn > 0.0) c = toneWheels(c);
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
  c = chroma(c);
  if (u_skinPull > 0.0) c = pullSkin(c);
  if (u_mixerOn > 0.0) c = mixer(c);
  if (u_splitOn > 0.0 || u_fade > 0.0) c = tone(c);
  if (u_vignette.x != 0.0) c = vignette(c);
  return c;
}
`;

/** Program key of a correction pass. */
export const CORRECT_KEY = "tint.correct";
/** Program key of a limited correction pass. */
export const CORRECT_KEYED_KEY = "tint.correct.keyed";

const LUT_COMMON = `
uniform vec3 u_lutMin;
uniform vec3 u_lutScale;
uniform float u_lutSize;
uniform float u_lutStrength;

vec3 lutAt(vec3 c) {
  vec3 t = clamp((c - u_lutMin) * u_lutScale, 0.0, 1.0);
  return (t * (u_lutSize - 1.0) + 0.5) / u_lutSize;
}`;

/** The uniforms of the LUT step. */
function lutUniforms({ table, strength }: PassLut): Record<string, GpuUniform> {
  const [lo, hi] = table.domain;
  return {
    u_lutMin: lo,
    u_lutScale: [0, 1, 2].map((c) => 1 / (hi[c]! - lo[c]!)),
    u_lutSize: table.size,
    u_lutStrength: strength,
  };
}

/**
 * The LUT step after Creative (`logic/cube.ts` `applyCube`): the color mapped from the domain onto
 * 0…1 and clamped, read at the texel centers `(t · (N − 1) + 0.5) / N` (trilinear in a 3D table, per
 * channel in a 1D one), mixed toward by strength. Without a LUT the step is left out of the program,
 * so no sampler of another type sits on a unit an input uses.
 */
const LUT_GLSL: Record<LutKind, string> = {
  none: "vec3 lut(vec3 c) { return c; }",
  "3d": `
uniform highp sampler3D u_lut;
${LUT_COMMON}
vec3 lut(vec3 c) { return mix(c, texture(u_lut, lutAt(c)).rgb, u_lutStrength); }`,
  "1d": `
uniform highp sampler2D u_lut;
${LUT_COMMON}
vec3 lut(vec3 c) {
  vec3 u = lutAt(c);
  vec3 t = vec3(
    texture(u_lut, vec2(u.r, 0.5)).r,
    texture(u_lut, vec2(u.g, 0.5)).g,
    texture(u_lut, vec2(u.b, 0.5)).b
  );
  return mix(c, t, u_lutStrength);
}`,
};

/** A correction's program: plain or limited (its key as `u_in1`), with or without a LUT. */
function fragment(keyed: boolean, lutKind: LutKind): string {
  const mixBy = keyed ? "finish(texture(u_in1, v_uv).r) * u_opacity" : "u_opacity";
  return `${BODY}
${keyed ? FINISH_GLSL : ""}
${LUT_GLSL[lutKind]}
void main() {
  vec4 src = texture(u_in0, v_uv);
  o = vec4(mix(src.rgb, lut(correct(src.rgb)), ${mixBy}), src.a);
}`;
}

/** Every correction program by key: `.keyed` when limited, `.lut3d` / `.lut1d` with a LUT. */
const PROGRAMS = new Map(
  [false, true].flatMap((keyed) =>
    (["none", "3d", "1d"] as const).map((lutKind) => {
      const base = keyed ? CORRECT_KEYED_KEY : CORRECT_KEY;
      const key = lutKind === "none" ? base : `${base}.lut${lutKind}`;
      return [`${keyed}:${lutKind}`, { key, fragment: fragment(keyed, lutKind) }] as const;
    }),
  ),
);

/**
 * A correction's pass over `input` (-1 the picture so far, n pass n), mixed over it by `opacity`.
 * `aspect` is the picture's width over its height (the vignette's shape). `tables.curves` is its
 * baked curve step (curves and Color mix) and `tables.warper` its warper, each left out when it
 * changes nothing (the shader then skips that step). With `limit`, the mix is also times the key
 * of pass `limit.key` (`keyPasses`), cleaned up and inverted by `limit.params`. `tables.lut` is its
 * LUT (`"3d"` or `"1d"` texture, its table's domain and size) with its strength, left out when there
 * is none or the strength is 0: the program then has no LUT step.
 */
export function correctPass(
  params: CorrectionParams,
  opacity: number,
  input: number,
  aspect: number,
  tables: { curves?: GpuTexture; warper?: GpuTexture; lut?: PassLut } = {},
  limit?: { key: number; params: LimitParams },
): GpuPass {
  const { curves, warper, lut } = tables;
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
    ...wheelsUniforms(params),
    ...tailUniforms(params, aspect),
    ...(limit && finishUniforms(limit.params)),
    ...(lut && lutUniforms(lut)),
  };
  const textures: Record<string, GpuTexture> = {};
  if (curves) textures.u_curves = curves;
  if (warper) textures.u_warp = warper;
  if (lut) textures.u_lut = lut.texture;
  const program = PROGRAMS.get(`${limit !== undefined}:${lut ? lut.table.kind : "none"}`)!;
  const pass: GpuPass = {
    ...program,
    inputs: limit ? [input, limit.key] : [input],
    uniforms,
  };
  return Object.keys(textures).length > 0 ? { ...pass, textures } : pass;
}
