import type { VideoLevels } from "../preview.types";
import type { GpuPass } from "./gpu.types";

// Rounded to 8-bit steps on the way in and out, as the table it replaced was, so an export of
// untouched video comes out byte for byte as before.
const FRAGMENT = `
uniform float u_black;
uniform float u_range;
void main() {
  vec4 c = texture(u_in0, v_uv);
  vec3 v = floor(c.rgb * 255.0 + 0.5);
  o = vec4(clamp(floor((v - u_black) * 255.0 / u_range + 0.5) / 255.0, 0.0, 1.0), c.a);
}`;

/**
 * Gives a video frame back its full range, for a webview that squeezes it (WebKitGTK does):
 * `black` goes to 0 and `white` to 255, on the source. `white` must be above `black`.
 */
export function levelsPass({ black, white }: VideoLevels): GpuPass {
  return {
    key: "preview.levels",
    fragment: FRAGMENT,
    inputs: [-1],
    uniforms: { u_black: black, u_range: white - black },
  };
}
