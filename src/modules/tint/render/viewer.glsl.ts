import type { GpuPass } from "@/modules/preview";
import { LUMA } from "../logic/color/basics";
import { CLIP_LUMA, FALSE_COLOR_BANDS, WARNING_RGB, WARNING_STRENGTH } from "../logic/bands";
import { glslFloat as f, glslVec3 as vec3 } from "./glsl.literals";

const HEAD = `const vec3 LUMA = ${vec3(LUMA)};
void main() {
  vec4 c = texture(u_in0, v_uv);
  float y = dot(c.rgb, LUMA);`;

/** Viewer pass `tint.falseColor`: every pixel painted by the band its luma falls in. Live only. */
export function falseColorPass(): GpuPass {
  const paint = FALSE_COLOR_BANDS.reduceRight<string>(
    (rest, band) =>
      rest === "" ? vec3(band.rgb) : `y < ${f(band.below)} ? ${vec3(band.rgb)} : ${rest}`,
    "",
  );
  return {
    key: "tint.viewer.false",
    inputs: [-1],
    fragment: `${HEAD}
  o = vec4(${paint}, c.a);
}`,
  };
}

/** Viewer pass `tint.warning`: magenta over pixels at or above the clip luma. Live only. */
export function clipWarningPass(): GpuPass {
  return {
    key: "tint.viewer.warning",
    inputs: [-1],
    fragment: `${HEAD}
  o = vec4(y >= ${f(CLIP_LUMA)} ? mix(c.rgb, ${vec3(WARNING_RGB)}, ${f(WARNING_STRENGTH)}) : c.rgb, c.a);
}`,
  };
}
