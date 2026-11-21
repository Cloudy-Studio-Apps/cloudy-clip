import { getPath, type PropCondition, type PropSpec } from "@/modules/element";

function holds(condition: PropCondition | undefined, values: Record<string, unknown>): boolean {
  if (condition === undefined) return true;
  return typeof condition === "function" ? condition(values) : getPath(values, condition) === true;
}

/** Whether a field shows, from its `visibleWhen`. */
export function isVisible(spec: PropSpec, values: Record<string, unknown>): boolean {
  return holds(spec.visibleWhen, values);
}

/**
 * Whether a field can be changed: not read-only, and its `enabledWhen` holds. With its `path` and
 * the subject's `fields`, also every group around it whose header switch (`toggle`) is on; the
 * switch itself stays enabled.
 */
export function isEnabled(
  spec: PropSpec,
  values: Record<string, unknown>,
  path?: string,
  fields?: ReadonlyMap<string, PropSpec>,
): boolean {
  if (spec.readOnly || !holds(spec.enabledWhen, values)) return false;
  if (path === undefined || !fields) return true;
  const parts = path.split(".");
  for (let i = 1; i < parts.length; i++) {
    const group = parts.slice(0, i).join(".");
    const toggle = fields.get(group)?.toggle;
    if (toggle === undefined) continue;
    const switchPath = `${group}.${toggle}`;
    if (switchPath !== path && getPath(values, switchPath) !== true) return false;
  }
  return true;
}
