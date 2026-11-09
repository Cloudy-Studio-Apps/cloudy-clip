/** A number as a GLSL float literal. */
export const glslFloat = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** Numbers as a GLSL `vec3` literal. */
export const glslVec3 = (v: readonly number[]): string => `vec3(${v.map(glslFloat).join(", ")})`;
