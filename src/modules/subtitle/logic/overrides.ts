import { deepEqual, getPath, isPlainObject } from "@/modules/element";
import type { SubtitleStyle } from "@/modules/project";

// The font is one value (family and source together), not a group of fields.
const WHOLE = new Set(["font"]);

/** Every value of a style by path: props one group level deep, then `transform.x` / `transform.y`. */
export function styleLeaves(style: SubtitleStyle): Map<string, unknown> {
  const leaves = new Map<string, unknown>();
  for (const [key, value] of Object.entries(style.props)) {
    if (isPlainObject(value) && !WHOLE.has(key)) {
      for (const [field, inner] of Object.entries(value)) leaves.set(`${key}.${field}`, inner);
    } else leaves.set(key, value);
  }
  leaves.set("transform.x", style.position.x);
  leaves.set("transform.y", style.position.y);
  return leaves;
}

/** The paths where a cue's values (resolved, with `transform`) differ from its style: its own. */
export function ownPaths(values: Record<string, unknown>, style: SubtitleStyle): string[] {
  return [...styleLeaves(style)]
    .filter(([path, value]) => !deepEqual(getPath(values, path), value))
    .map(([path]) => path);
}

/**
 * The nested patch that moves a cue from style `from` to `to`: each of `to`'s values where the cue
 * followed `from` (every value when `from` is null, a fresh mark), skipping `keyed` paths and
 * values the cue already has.
 */
export function restylePatch(
  values: Record<string, unknown>,
  from: SubtitleStyle | null,
  to: SubtitleStyle,
  keyed: ReadonlySet<string>,
): Record<string, unknown> {
  const old = from && styleLeaves(from);
  const patch: Record<string, unknown> = {};
  for (const [path, value] of styleLeaves(to)) {
    const current = getPath(values, path);
    if (keyed.has(path) || deepEqual(current, value)) continue;
    if (old && !deepEqual(current, old.get(path))) continue;
    const [head, field] = path.split(".") as [string, string | undefined];
    if (field === undefined) patch[head] = value;
    else ((patch[head] ??= {}) as Record<string, unknown>)[field] = value;
  }
  return patch;
}
