import { isPlainObject } from "./values";

/** Every path in a patch: groups and their fields (`outline`, `outline.width`). */
export function leafPaths(values: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    out.push(prefix + key);
    if (isPlainObject(value)) out.push(...leafPaths(value, `${prefix}${key}.`));
  }
  return out;
}
