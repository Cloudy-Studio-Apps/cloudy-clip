import { getPath, type PropCondition, type PropSpec } from "@/modules/element";

function holds(condition: PropCondition | undefined, values: Record<string, unknown>): boolean {
  if (condition === undefined) return true;
  return typeof condition === "function" ? condition(values) : getPath(values, condition) === true;
}

/** Whether a field shows, from its `visibleWhen`. */
export function isVisible(spec: PropSpec, values: Record<string, unknown>): boolean {
  return holds(spec.visibleWhen, values);
}

/** Whether a field can be changed: not read-only, and its `enabledWhen` holds. */
export function isEnabled(spec: PropSpec, values: Record<string, unknown>): boolean {
  return !spec.readOnly && holds(spec.enabledWhen, values);
}
