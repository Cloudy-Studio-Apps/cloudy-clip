import type { ColorRows, VideoLevels } from "../preview.types";
import type { GpuPass } from "./gpu.types";

// Rounded to 8-bit steps on the way in and out, as the table it replaced was, so an export of
// untouched video comes out byte for byte as before (identity rows change nothing).
const FRAGMENT = `
uniform float u_black;
uniform float u_range;
uniform vec3 u_r;
uniform vec3 u_g;
uniform vec3 u_b;
void main() {
  vec4 c = texture(u_in0, v_uv);
  vec3 v = (floor(c.rgb * 255.0 + 0.5) - u_black) * 255.0 / u_range;
  v = vec3(dot(u_r, v), dot(u_g, v), dot(u_b, v));
  o = vec4(clamp(floor(v + 0.5) / 255.0, 0.0, 1.0), c.a);
}`;

const FULL: VideoLevels = { black: 0, white: 255 };
const IDENTITY: ColorRows = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/**
 * Gives a video frame back what the webview took from it: its full range, for a webview that
 * squeezes it (WebKitGTK does), `black` going to 0 and `white` to 255 (`white` above `black`);
 * then its intended matrix, for one that decoded it with the other (`rows`, from
 * `logic/matrix.ts`). Null for either leaves it as it is.
 */
export function levelsPass(levels: VideoLevels | null, rows: ColorRows | null): GpuPass {
  const { black, white } = levels ?? FULL;
  const [r, g, b] = rows ?? IDENTITY;
  return {
    key: "preview.levels",
    fragment: FRAGMENT,
    inputs: [-1],
    uniforms: { u_black: black, u_range: white - black, u_r: r, u_g: g, u_b: b },
  };
}
