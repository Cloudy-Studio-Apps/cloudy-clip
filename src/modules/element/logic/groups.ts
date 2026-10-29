import type { PropertyTree, PropSpec, SharedGroup } from "../element.types";

/** What an element may change about a shared field. */
const OVERRIDABLE = [
  "label",
  "control",
  "ui",
  "display",
  "hidden",
  "readOnly",
  "min",
  "max",
] as const;

/**
 * A shared group as an element uses it: without the `except` fields, with the element's
 * `"<key>.<field>"` overrides applied. Overrides only narrow: `min`/`max` stay inside the group's
 * range, and other keys are ignored with a warning.
 */
export function narrowGroup(
  group: SharedGroup,
  how: true | { except: readonly string[] },
  overrides: PropertyTree,
  warn: (message: string) => void,
  kind: string,
): SharedGroup {
  const except = new Set(how === true ? [] : how.except);
  const properties: Record<string, PropSpec> = {};
  for (const [name, spec] of Object.entries(group.properties)) {
    if (except.has(name)) continue;
    const override = overrides[`${group.key}.${name}`];
    if (!override) {
      properties[name] = spec;
      continue;
    }
    const next: PropSpec = { ...spec };
    for (const [key, value] of Object.entries(override)) {
      if (key === "kind") continue;
      if (!(OVERRIDABLE as readonly string[]).includes(key)) {
        warn(`element "${kind}": "${group.key}.${name}" can't override "${key}"`);
        continue;
      }
      (next as unknown as Record<string, unknown>)[key] = value;
    }
    if (next.min !== undefined && spec.min !== undefined) next.min = Math.max(next.min, spec.min);
    if (next.max !== undefined && spec.max !== undefined) next.max = Math.min(next.max, spec.max);
    properties[name] = next;
  }
  return { ...group, properties };
}
