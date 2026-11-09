import { BLEND_MODES, type BlendMode } from "@/modules/project";

/** A mode's number in the GLSL: its place in `BLEND_MODES`. */
const at = (mode: BlendMode) => BLEND_MODES.indexOf(mode);

/**
 * GLSL of every blend mode, as the canvas does them (W3C Compositing and Blending): declares
 * `vec3 blend(int mode, vec3 base, vec3 top)`, where `mode` is the mode's index in `BLEND_MODES`
 * (pass it with `gpuInt`), `base` is what lies under and `top` the layer, both 0…1 and not
 * premultiplied. Opacity and alpha are the caller's.
 */
export const BLEND_GLSL = `
float blendLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
float blendSat(vec3 c) { return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
vec3 blendClip(vec3 c) {
  float l = blendLum(c);
  float n = min(c.r, min(c.g, c.b));
  float x = max(c.r, max(c.g, c.b));
  if (n < 0.0) c = l + (c - l) * l / (l - n);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);
  return c;
}
vec3 blendSetLum(vec3 c, float l) { return blendClip(c + (l - blendLum(c))); }
vec3 blendSetSat(vec3 c, float s) {
  float n = min(c.r, min(c.g, c.b));
  float x = max(c.r, max(c.g, c.b));
  return x > n ? (c - n) * s / (x - n) : vec3(0.0);
}
vec3 blendScreen(vec3 b, vec3 t) { return b + t - b * t; }
vec3 blendHard(vec3 b, vec3 t) {
  return mix(b * 2.0 * t, blendScreen(b, 2.0 * t - 1.0), vec3(greaterThan(t, vec3(0.5))));
}
vec3 blendSoft(vec3 b, vec3 t) {
  vec3 d = mix(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, vec3(lessThanEqual(b, vec3(0.25))));
  vec3 low = b - (1.0 - 2.0 * t) * b * (1.0 - b);
  vec3 high = b + (2.0 * t - 1.0) * (d - b);
  return mix(low, high, vec3(greaterThan(t, vec3(0.5))));
}
float blendDodge(float b, float t) {
  if (b == 0.0) return 0.0;
  if (t >= 1.0) return 1.0;
  return min(1.0, b / (1.0 - t));
}
float blendBurn(float b, float t) {
  if (b >= 1.0) return 1.0;
  if (t <= 0.0) return 0.0;
  return 1.0 - min(1.0, (1.0 - b) / t);
}
vec3 blend(int mode, vec3 base, vec3 top) {
  if (mode == ${at("add")}) return min(base + top, 1.0);
  if (mode == ${at("multiply")}) return base * top;
  if (mode == ${at("screen")}) return blendScreen(base, top);
  if (mode == ${at("overlay")}) return blendHard(top, base);
  if (mode == ${at("softLight")}) return blendSoft(base, top);
  if (mode == ${at("hardLight")}) return blendHard(base, top);
  if (mode == ${at("darken")}) return min(base, top);
  if (mode == ${at("lighten")}) return max(base, top);
  if (mode == ${at("colorDodge")}) {
    return vec3(blendDodge(base.r, top.r), blendDodge(base.g, top.g), blendDodge(base.b, top.b));
  }
  if (mode == ${at("colorBurn")}) {
    return vec3(blendBurn(base.r, top.r), blendBurn(base.g, top.g), blendBurn(base.b, top.b));
  }
  if (mode == ${at("difference")}) return abs(base - top);
  if (mode == ${at("exclusion")}) return base + top - 2.0 * base * top;
  if (mode == ${at("hue")}) return blendSetLum(blendSetSat(top, blendSat(base)), blendLum(base));
  if (mode == ${at("saturation")}) {
    return blendSetLum(blendSetSat(base, blendSat(top)), blendLum(base));
  }
  if (mode == ${at("color")}) return blendSetLum(top, blendLum(base));
  if (mode == ${at("luminosity")}) return blendSetLum(base, blendLum(top));
  return top;
}
`;
