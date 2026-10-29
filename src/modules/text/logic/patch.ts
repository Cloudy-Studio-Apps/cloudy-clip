import type { TextStylePatch } from "@/modules/project";

/** Two patches in one: later fields win; nested groups (fill, outline, …) merge one level deep. */
export function mergePatch(a: TextStylePatch, b: TextStylePatch): TextStylePatch {
  const out: Record<string, unknown> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const before = out[key];
    out[key] =
      typeof value === "object" && value !== null && typeof before === "object" && before !== null
        ? { ...before, ...value }
        : value;
  }
  return out as TextStylePatch;
}
