import type { BlendMode } from "@/modules/project";
import type { Rgb } from "../../tint.types";

// The CPU reference of `preview`'s `BLEND_GLSL` (W3C Compositing and Blending, as the canvas does
// them), line for line, so a stacked group's picture can be checked against the shader.

const each = (a: Rgb, b: Rgb, fn: (x: number, y: number) => number): Rgb => [
  fn(a[0], b[0]),
  fn(a[1], b[1]),
  fn(a[2], b[2]),
];

const lum = (c: Rgb) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
const sat = (c: Rgb) => Math.max(...c) - Math.min(...c);

function clip(c: Rgb): Rgb {
  const l = lum(c);
  const n = Math.min(...c);
  const x = Math.max(...c);
  let out = c;
  if (n < 0) out = out.map((v) => l + ((v - l) * l) / (l - n)) as Rgb;
  if (x > 1) out = out.map((v) => l + ((v - l) * (1 - l)) / (x - l)) as Rgb;
  return out;
}

const setLum = (c: Rgb, l: number): Rgb => {
  const d = l - lum(c);
  return clip([c[0] + d, c[1] + d, c[2] + d]);
};

function setSat(c: Rgb, s: number): Rgb {
  const n = Math.min(...c);
  const x = Math.max(...c);
  return x > n ? (c.map((v) => ((v - n) * s) / (x - n)) as Rgb) : [0, 0, 0];
}

const screen = (b: number, t: number) => b + t - b * t;
const hard = (b: number, t: number) => (t > 0.5 ? screen(b, 2 * t - 1) : b * 2 * t);

function soft(b: number, t: number): number {
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return t > 0.5 ? b + (2 * t - 1) * (d - b) : b - (1 - 2 * t) * b * (1 - b);
}

function dodge(b: number, t: number): number {
  if (b === 0) return 0;
  if (t >= 1) return 1;
  return Math.min(1, b / (1 - t));
}

function burn(b: number, t: number): number {
  if (b >= 1) return 1;
  if (t <= 0) return 0;
  return 1 - Math.min(1, (1 - b) / t);
}

/** `top` over `base` by a blend mode, both 0…1 and not premultiplied, as `BLEND_GLSL`'s `blend`. */
export function blendRgb(mode: BlendMode, base: Rgb, top: Rgb): Rgb {
  switch (mode) {
    case "add":
      return each(base, top, (b, t) => Math.min(b + t, 1));
    case "multiply":
      return each(base, top, (b, t) => b * t);
    case "screen":
      return each(base, top, screen);
    case "overlay":
      return each(base, top, (b, t) => hard(t, b));
    case "softLight":
      return each(base, top, soft);
    case "hardLight":
      return each(base, top, hard);
    case "darken":
      return each(base, top, Math.min);
    case "lighten":
      return each(base, top, Math.max);
    case "colorDodge":
      return each(base, top, dodge);
    case "colorBurn":
      return each(base, top, burn);
    case "difference":
      return each(base, top, (b, t) => Math.abs(b - t));
    case "exclusion":
      return each(base, top, (b, t) => b + t - 2 * b * t);
    case "hue":
      return setLum(setSat(top, sat(base)), lum(base));
    case "saturation":
      return setLum(setSat(base, sat(top)), lum(base));
    case "color":
      return setLum(top, lum(base));
    case "luminosity":
      return setLum(base, lum(top));
    case "normal":
      return top;
  }
}
