import type { GpuPass } from "./gpu.types";

/** The widest sigma a blur pass takes, in pixels of what it runs on; a larger one runs shrunk. */
export const MAX_BLUR_SIGMA = 16;

// One axis of a Gaussian on alpha, out to 3 sigma (48 taps each side at most); colour stays white.
const BLUR = `
uniform vec2 u_dir;
uniform float u_sigma;
void main() {
  vec2 texel = u_dir / vec2(textureSize(u_in0, 0));
  float reach = ceil(u_sigma * 3.0);
  float sum = 0.0;
  float weight = 0.0;
  for (int i = -48; i <= 48; i++) {
    float d = float(i);
    if (abs(d) > reach) continue;
    float w = exp(-0.5 * d * d / (u_sigma * u_sigma));
    sum += texture(u_in0, v_uv + texel * d).a * w;
    weight += w;
  }
  o = vec4(1.0, 1.0, 1.0, sum / weight);
}`;

const LUMA = `
uniform float u_invert;
void main() {
  vec4 c = texture(u_in0, v_uv);
  float a = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)) * c.a;
  o = vec4(1.0, 1.0, 1.0, mix(a, 1.0 - a, u_invert));
}`;

/**
 * A separable Gaussian on alpha, x then y, each sigma in pixels of the run (at most
 * `MAX_BLUR_SIGMA`); an axis at 0 is left out. At least one sigma must be above 0.
 */
export function blurPasses(sigmaX: number, sigmaY: number): GpuPass[] {
  const passes: GpuPass[] = [];
  const axis = (dir: readonly number[], sigma: number) => {
    if (sigma <= 0) return;
    const input = passes.length - 1;
    passes.push({
      key: "mask.blur",
      fragment: BLUR,
      inputs: [input],
      uniforms: { u_dir: dir, u_sigma: sigma },
    });
  };
  axis([1, 0], sigmaX);
  axis([0, 1], sigmaY);
  return passes;
}

/** A picture's brightness (Rec. 709) times its alpha as the alpha, or one minus that inverted. */
export function lumaAlphaPass(invert: boolean): GpuPass {
  return { key: "mask.luma", fragment: LUMA, inputs: [-1], uniforms: { u_invert: invert ? 1 : 0 } };
}
