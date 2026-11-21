import type { GpuPass, MixGpu } from "@/modules/junction";

// Points and directions come in canvas uv (0,0 top left, y down). Sources upload flipped, so in
// the shader y runs up: `up` turns one into the other. Distances are in frame heights (a square
// space, x scaled by the aspect) so circles stay round; the aspect comes from the input's size.
const up = (y: number) => 1 - y;

/** Taps per blur, fixed so the program is one per key. */
const TAPS = 16;

const ASPECT = `
float aspect() {
  vec2 size = vec2(textureSize(u_in0, 0));
  return size.x / size.y;
}`;

// Samples from the pixel toward the center, scaling its distance by 1 down to 1 - strength.
const ZOOM = `
uniform vec2 u_center;
uniform float u_strength;
void main() {
  vec2 d = v_uv - u_center;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < ${TAPS}; i++) {
    float t = float(i) / ${TAPS - 1}.0;
    sum += texture(u_in0, u_center + d * (1.0 - u_strength * t));
  }
  o = sum / ${TAPS}.0;
}`;

// Samples around the center over -angle/2..angle/2, rotating in the square space.
const SPIN = `${ASPECT}
uniform vec2 u_center;
uniform float u_angle;
void main() {
  vec2 scale = vec2(aspect(), 1.0);
  vec2 d = (v_uv - u_center) * scale;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < ${TAPS}; i++) {
    float a = u_angle * (float(i) / ${TAPS - 1}.0 - 0.5);
    float c = cos(a);
    float s = sin(a);
    sum += texture(u_in0, u_center + vec2(c * d.x - s * d.y, s * d.x + c * d.y) / scale);
  }
  o = sum / ${TAPS}.0;
}`;

// Samples along the step (frame heights) over -1/2..1/2 of it.
const DIRECTIONAL = `${ASPECT}
uniform vec2 u_step;
void main() {
  vec2 stride = u_step / vec2(aspect(), 1.0);
  vec4 sum = vec4(0.0);
  for (int i = 0; i < ${TAPS}; i++) {
    sum += texture(u_in0, v_uv + stride * (float(i) / ${TAPS - 1}.0 - 0.5));
  }
  o = sum / ${TAPS}.0;
}`;

// B shows where the key (A's Rec. 709 luma, or one minus it) is below the threshold.
const LUMA_KEY = `
uniform float u_threshold;
uniform float u_softness;
uniform float u_invert;
void main() {
  vec4 a = texture(u_in0, v_uv);
  float luma = clamp(dot(a.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  float key = mix(luma, 1.0 - luma, u_invert);
  float soft = max(u_softness, 1e-4);
  float show = 1.0 - smoothstep(u_threshold - soft, u_threshold + soft, key);
  o = mix(a, texture(u_in1, v_uv), show);
}`;

// Pushes each pixel along its ray from the center by amount * sin(rings * distance - phase).
const RIPPLE = `${ASPECT}
uniform vec2 u_center;
uniform float u_amount;
uniform float u_phase;
const float RINGS = 40.0;
void main() {
  vec2 scale = vec2(aspect(), 1.0);
  vec2 d = (v_uv - u_center) * scale;
  float r = length(d);
  vec2 ray = r > 0.0 ? d / r : vec2(0.0);
  float push = u_amount * sin(RINGS * r - u_phase);
  o = texture(u_in0, v_uv + ray * push / scale);
}`;

/**
 * A radial blur toward `center` (canvas uv, y down): each pixel averages 16 taps from where it is
 * to `strength` (0..1) of the way to the center. 0 returns the input unchanged.
 */
export function zoomBlurPass(input: number, center: [number, number], strength: number): GpuPass {
  return {
    key: "transition.zoomBlur",
    fragment: ZOOM,
    inputs: [input],
    uniforms: { u_center: [center[0], up(center[1])], u_strength: strength },
  };
}

/**
 * A rotational blur about `center` (canvas uv, y down): 16 taps spread over `angle` radians,
 * half each way, round on any aspect. 0 returns the input unchanged.
 */
export function spinBlurPass(input: number, center: [number, number], angle: number): GpuPass {
  return {
    key: "transition.spinBlur",
    fragment: SPIN,
    inputs: [input],
    uniforms: { u_center: [center[0], up(center[1])], u_angle: angle },
  };
}

/**
 * A blur along `dir` (canvas direction, y down; normalized here) over `length` frame heights,
 * half each way, in 16 taps, the same length on both axes. A `length` of 0 (or a zero `dir`)
 * returns the input unchanged.
 */
export function directionalBlurPass(input: number, dir: [number, number], length: number): GpuPass {
  const norm = Math.hypot(dir[0], dir[1]);
  const k = norm > 0 ? length / norm : 0;
  return {
    key: "transition.directionalBlur",
    fragment: DIRECTIONAL,
    inputs: [input],
    uniforms: { u_step: [dir[0] * k, -dir[1] * k] },
  };
}

/**
 * Reveals `b` through `a` by `a`'s Rec. 709 luma: B shows where the key is below `threshold`,
 * with `softness` either side. The key is the luma (dark first) or, with `invert`, one minus it
 * (light first). A `threshold` of `-softness` is exactly A, `1 + softness` exactly B.
 */
export function lumaKeyPass(
  a: number,
  b: number,
  threshold: number,
  softness: number,
  invert: boolean,
): GpuPass {
  return {
    key: "transition.lumaKey",
    fragment: LUMA_KEY,
    inputs: [a, b],
    uniforms: { u_threshold: threshold, u_softness: softness, u_invert: invert ? 1 : 0 },
  };
}

/**
 * Ripples `input` out from `center` (canvas uv, y down): each pixel moves along its ray from the
 * center by `amount` frame heights times a sine of its distance (40 radians per frame height)
 * minus `phase`. 0 returns the input unchanged.
 */
export function ripplePass(
  input: number,
  center: [number, number],
  amount: number,
  phase: number,
): GpuPass {
  return {
    key: "transition.ripple",
    fragment: RIPPLE,
    inputs: [input],
    uniforms: { u_center: [center[0], up(center[1])], u_amount: amount, u_phase: phase },
  };
}

// A mix of two inputs by amount.
const MIX = `
uniform float u_amount;
void main() {
  o = mix(texture(u_in0, v_uv), texture(u_in1, v_uv), u_amount);
}`;

/** Mixes input `a` into input `b` by `amount` (0 is exactly `a`, 1 exactly `b`). */
export function mixPass(a: number, b: number, amount: number): GpuPass {
  return { key: "transition.mix", fragment: MIX, inputs: [a, b], uniforms: { u_amount: amount } };
}

/**
 * Runs `passes` over `sources` at `ctx.canvas`'s size and draws the result over the whole canvas
 * (identity transform). Throws what `gpu.run` throws.
 */
export function drawGpu(
  ctx: CanvasRenderingContext2D,
  gpu: MixGpu,
  sources: readonly CanvasImageSource[],
  passes: readonly GpuPass[],
): void {
  const { width, height } = ctx.canvas;
  ctx.drawImage(gpu.run(sources, ctx.canvas, passes), 0, 0, width, height);
}
