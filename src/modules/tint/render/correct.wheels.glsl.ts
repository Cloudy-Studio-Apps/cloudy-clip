import type { GpuUniform } from "@/modules/preview";
import { ZONE_WIDTH } from "../logic/color/wheels";
import type { CorrectionParams } from "../tint.types";
import { glslFloat as f } from "./glsl.literals";

// The log and zone wheels as GLSL, line for line with `toneWheels` in `logic/color/wheels.ts`.
// Part of the `tint.correct` program (`correct.glsl.ts`), after the primary wheels.

/** The uniforms and the function `toneWheels(c)`. Needs `LUMA`. */
export const WHEELS_GLSL = `
uniform float u_logOn;
uniform vec3 u_logShadow;
uniform vec3 u_logMid;
uniform vec3 u_logHigh;
uniform vec2 u_logRange;
uniform float u_zonesOn;
uniform float u_zoneAdd[18];
uniform float u_zoneAt[6];

vec3 toneWheels(vec3 c) {
  float y = dot(c, LUMA);
  vec3 add = vec3(0.0);
  if (u_logOn > 0.0) {
    float ws = 1.0 - smoothstep(0.0, u_logRange.x, y);
    float wh = smoothstep(u_logRange.y, 1.0, y);
    add += ws * u_logShadow + (1.0 - ws) * (1.0 - wh) * u_logMid + wh * u_logHigh;
  }
  if (u_zonesOn > 0.0) {
    for (int z = 0; z < 6; z++) {
      float w = 1.0 - smoothstep(0.0, ${f(ZONE_WIDTH)}, abs(y - u_zoneAt[z]));
      add += w * vec3(u_zoneAdd[z * 3], u_zoneAdd[z * 3 + 1], u_zoneAdd[z * 3 + 2]);
    }
  }
  return c + add;
}
`;

const none: readonly number[] = [0, 0, 0];

/** The uniforms of `WHEELS_GLSL`, every one set (a program is shared, so off is 0, not left out). */
export function wheelsUniforms(p: CorrectionParams): Record<string, GpuUniform> {
  return {
    u_logOn: p.log ? 1 : 0,
    u_logShadow: p.log?.shadow ?? none,
    u_logMid: p.log?.midtone ?? none,
    u_logHigh: p.log?.highlight ?? none,
    u_logRange: [p.log?.low ?? 0.5, p.log?.high ?? 0.5],
    u_zonesOn: p.zones ? 1 : 0,
    u_zoneAdd: p.zones?.add ?? new Array<number>(18).fill(0),
    u_zoneAt: p.zones?.at ?? new Array<number>(6).fill(0),
  };
}
