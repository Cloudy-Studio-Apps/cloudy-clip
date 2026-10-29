/** Whether a value is a plain object (a group of values), not an array or null. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural equality of plain values (numbers, strings, arrays, objects). */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function definedOnly(group: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(group).filter(([, v]) => v !== undefined));
}

/** `base` with `patch` applied; groups merge one level deep; `undefined` values are skipped. */
export function mergeProps<T extends Record<string, unknown>>(
  base: T,
  patch: Record<string, unknown>,
): T {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = next[key];
    next[key] =
      isPlainObject(value) && isPlainObject(current)
        ? { ...current, ...definedOnly(value) }
        : value;
  }
  return next as T;
}

/** A clip's values: what it stores over the defaults. */
export function resolveProps<T extends Record<string, unknown>>(
  stored: Record<string, unknown>,
  defaults: T,
): T {
  return mergeProps(defaults, stored);
}

/** Only the values that differ from the defaults (groups field by field; empty groups dropped). */
export function minimizeProps(
  full: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(full)) {
    const base = defaults[key];
    if (isPlainObject(value) && isPlainObject(base)) {
      const inner = Object.fromEntries(
        Object.entries(value).filter(([k, v]) => !deepEqual(v, base[k])),
      );
      if (Object.keys(inner).length > 0) out[key] = inner;
    } else if (!deepEqual(value, base)) {
      out[key] = value;
    }
  }
  return out;
}

/** The value at a dotted path (`"outline.width"`), or undefined. */
export function getPath(values: unknown, path: string): unknown {
  let at = values;
  for (const part of path.split(".")) {
    if (!isPlainObject(at)) return undefined;
    at = at[part];
  }
  return at;
}
