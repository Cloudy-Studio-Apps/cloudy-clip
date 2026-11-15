import { GRADE_RANGES } from "@/modules/project";
import type { ToolId } from "../tint.types";
import { TOOL_FIELDS } from "./tools";

/**
 * The correction values that can hold keys, by dotted path under `values` (`saturation`,
 * `lift.x`, `creative.vignette.amount`): every number of `GRADE_RANGES` that the shader takes as a
 * uniform. Color mix, the warper and the mixer are left out: Color mix and the warper are baked
 * into tables, which a keyed value would bake again every frame, and the mixer is a matrix.
 */
export const KEYABLE_VALUES: readonly string[] = Object.keys(GRADE_RANGES).filter(
  (path) => !/^(mix|warper|mixer)\./.test(path),
);

/**
 * The keyable value paths of a tool, under `values`: those under the fields it owns
 * (`TOOL_FIELDS`, what its reset clears); none for a tool without numbers to key.
 */
export function toolKeyPaths(tool: ToolId): string[] {
  const owned: readonly string[] = TOOL_FIELDS[tool].values;
  return KEYABLE_VALUES.filter((path) => owned.includes(path.split(".")[0]!));
}

/** A field's label from its path: `creative.vignette.amount` → `Creative vignette amount`. */
export function fieldLabel(path: string): string {
  const words = path
    .split(".")
    .join(" ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The value at a dotted path of an object, or undefined. */
export function leafAt(root: unknown, path: string): unknown {
  let at = root;
  for (const part of path.split(".")) {
    if (typeof at !== "object" || at === null || !Object.hasOwn(at, part)) return undefined;
    at = (at as Record<string, unknown>)[part];
  }
  return at;
}

/** `root` (a plain object) with `value` at a dotted path, copying only what lies along it. */
export function withLeaf(root: unknown, path: string, value: unknown): unknown {
  const [head, ...rest] = path.split(".");
  const base = typeof root === "object" && root !== null ? (root as Record<string, unknown>) : {};
  if (rest.length === 0) return { ...base, [head!]: value };
  return { ...base, [head!]: withLeaf(base[head!], rest.join("."), value) };
}
