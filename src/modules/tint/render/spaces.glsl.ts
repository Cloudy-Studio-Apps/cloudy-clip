import type { GpuPass } from "@/modules/preview";
import type { InputColorSpace } from "@/modules/project";
import { REC709 } from "../logic/color/basics";
import {
  APPLE_LOG,
  CANON_SCALE,
  CLOG2,
  CLOG3,
  FLOG,
  SLOG3,
  SPACE_GAMUTS,
  SRGB,
  VLOG,
} from "../logic/color/spaces";
import { glslFloat as f, glslVec3 as vec3 } from "./glsl.literals";

// A camera color space to Rec.709 as GLSL, line for line with `logic/color/spaces.ts` (formulas,
// sources and the gray/white check there), every constant written in from it.

const CV = `float codeValue(float v) { return (876.0 * v + 64.0) / 1023.0; }`;

/** Each space's curve as the body of `float curve(float v)`. */
const CURVES: Record<Exclude<InputColorSpace, "rec709">, string> = {
  srgb: `return v <= ${f(SRGB.cut)} ? v / ${f(SRGB.slope)}
    : pow((v + ${f(SRGB.a)}) / ${f(1 + SRGB.a)}, ${f(SRGB.power)});`,
  slog3: `float cv = codeValue(v) * 1023.0;
  return cv >= ${f(SLOG3.cut)} ? pow(10.0, (cv - ${f(SLOG3.gray)}) / ${f(SLOG3.step)}) * 0.19 - 0.01
    : (cv - ${f(SLOG3.black)}) * ${f(SLOG3.toe)} / ${f(SLOG3.cut - SLOG3.black)};`,
  vlog: `float x = codeValue(v);
  return x >= ${f(VLOG.cut)} ? pow(10.0, (x - ${f(VLOG.d)}) / ${f(VLOG.c)}) - ${f(VLOG.b)}
    : (x - ${f(VLOG.e)}) / ${f(VLOG.f)};`,
  flog: `float x = codeValue(v);
  return x >= ${f(FLOG.cut)} ? (pow(10.0, (x - ${f(FLOG.d)}) / ${f(FLOG.c)}) - ${f(FLOG.b)}) / ${f(FLOG.a)}
    : (x - ${f(FLOG.f)}) / ${f(FLOG.e)};`,
  clog2: `float x = codeValue(v);
  float l = x >= ${f(CLOG2.cut)} ? (pow(10.0, (x - ${f(CLOG2.cut)}) / ${f(CLOG2.c)}) - 1.0) / ${f(CLOG2.a)}
    : -(pow(10.0, (${f(CLOG2.cut)} - x) / ${f(CLOG2.c)}) - 1.0) / ${f(CLOG2.a)};
  return l * ${f(CANON_SCALE)};`,
  clog3: `float x = codeValue(v);
  float l = x < ${f(CLOG3.low)} ? -(pow(10.0, (${f(CLOG3.lowAt)} - x) / ${f(CLOG3.c)}) - 1.0) / ${f(CLOG3.a)}
    : x <= ${f(CLOG3.high)} ? (x - ${f(CLOG3.midAt)}) / ${f(CLOG3.slope)}
    : (pow(10.0, (x - ${f(CLOG3.highAt)}) / ${f(CLOG3.c)}) - 1.0) / ${f(CLOG3.a)};
  return l * ${f(CANON_SCALE)};`,
  appleLog: `float x = codeValue(v);
  return x >= ${f(APPLE_LOG.cut)} ? exp2((x - ${f(APPLE_LOG.delta)}) / ${f(APPLE_LOG.gamma)}) - ${f(APPLE_LOG.beta)}
    : x >= 0.0 ? sqrt(x / ${f(APPLE_LOG.c)}) + ${f(APPLE_LOG.r0)} : ${f(APPLE_LOG.r0)};`,
};

const fragment = (space: Exclude<InputColorSpace, "rec709">) => {
  const m = SPACE_GAMUTS[space];
  return `
${CV}

float curve(float v) {
  ${CURVES[space]}
}

float toDisplay(float l) {
  return l < ${f(REC709.toe / REC709.slope)} ? ${f(REC709.slope)} * l
    : ${f(1 + REC709.a)} * pow(l, ${f(REC709.power)}) - ${f(REC709.a)};
}

void main() {
  vec4 c = texture(u_in0, v_uv);
  vec3 l = vec3(curve(c.r), curve(c.g), curve(c.b));
${m ? `  l = vec3(dot(${vec3(m[0])}, l), dot(${vec3(m[1])}, l), dot(${vec3(m[2])}, l));` : ""}
  o = vec4(clamp(vec3(toDisplay(l.r), toDisplay(l.g), toDisplay(l.b)), 0.0, 1.0), c.a);
}`;
};

/**
 * The source in a camera color space turned into Rec.709 (`toRec709`), the first pass of a grade.
 * One program per space (`tint.input.<space>`). Never asked for Rec.709, which adds no pass.
 */
export function inputPass(space: Exclude<InputColorSpace, "rec709">): GpuPass {
  return { key: `tint.input.${space}`, fragment: fragment(space), inputs: [-1] };
}
