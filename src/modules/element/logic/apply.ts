import type { CommandContext } from "@/core";
import type { Clip, ClipTransform, ProjectFormat } from "@/modules/project";
import type { GroupWrites, ResolvedElement } from "../element.types";
import { groupValue } from "./clip";
import { deepEqual, isPlainObject, mergeProps, minimizeProps, resolveProps } from "./values";

/**
 * The clip's stored props after `patch` (normalized, minimized). Shared group keys are skipped; a
 * patch of shared groups only leaves the props as they are (the element's `normalize` doesn't run).
 */
export function applyPropsPatch(
  ctx: CommandContext,
  element: ResolvedElement,
  clip: Clip,
  patch: Record<string, unknown>,
  format: ProjectFormat,
): Record<string, unknown> {
  const own = Object.fromEntries(
    Object.entries(patch).filter(([key]) => !element.groups.some((g) => g.key === key)),
  );
  if (Object.keys(own).length === 0) return clip.props ?? {};
  const merged = mergeProps(clip.props ?? {}, own);
  return finishProps(ctx, element, merged, patch, format);
}

/** Stored props as they are kept: over the defaults, through `normalize`, minus the defaults. */
export function finishProps(
  ctx: CommandContext,
  element: ResolvedElement,
  props: Record<string, unknown>,
  patch: Record<string, unknown>,
  format: ProjectFormat,
): Record<string, unknown> {
  const { definition } = element;
  const defaults = definition.defaults(format);
  const merged = resolveProps(props, defaults);
  const next = definition.normalize
    ? definition.normalize(merged, { patch, format, require: ctx.require })
    : merged;
  return minimizeProps(next, defaults);
}

/** The groups' new values for the groups named in `patch`. */
export function applyGroupPatch(
  element: ResolvedElement,
  clip: Clip,
  patch: Record<string, unknown>,
  format: ProjectFormat,
): GroupWrites {
  const writes: GroupWrites = [];
  for (const group of element.groups) {
    const change = patch[group.key];
    if (!isPlainObject(change)) continue;
    const defaults = group.defaults(format);
    const merged = mergeProps(mergeProps(defaults, groupValue(clip, group.key)), change);
    const value = group.normalize ? group.normalize(merged) : merged;
    writes.push([
      group.key,
      deepEqual(value, defaults) ? undefined : (value as unknown as ClipTransform),
    ]);
  }
  return writes;
}

/** Props and group values with `paths` back to the defaults (every prop when `paths` is missing). */
export function resetPaths(
  element: ResolvedElement,
  clip: Clip,
  paths: readonly string[] | undefined,
  format: ProjectFormat,
): { props: Record<string, unknown>; groups: GroupWrites } {
  if (!paths) return { props: {}, groups: [] };
  const props = structuredClone(clip.props ?? {});
  /** Each group's values so far, so several paths of one group add up. */
  const working = new Map<string, Record<string, unknown> | undefined>();
  for (const path of paths) {
    const [head, field] = path.split(".") as [string, string | undefined];
    const group = element.groups.find((g) => g.key === head);
    if (group) {
      const defaults = group.defaults(format);
      if (field === undefined) {
        working.set(group.key, undefined);
        continue;
      }
      const before = working.has(group.key)
        ? (working.get(group.key) ?? defaults)
        : mergeProps(defaults, groupValue(clip, group.key));
      working.set(group.key, { ...before, [field]: defaults[field] });
      continue;
    }
    if (field === undefined) {
      delete props[head];
      continue;
    }
    const inner = props[head];
    if (!isPlainObject(inner)) continue;
    delete inner[field];
    if (Object.keys(inner).length === 0) delete props[head];
  }
  const groups: GroupWrites = [...working].map(([key, value]) => {
    const group = element.groups.find((g) => g.key === key)!;
    const reset = value === undefined || deepEqual(value, group.defaults(format));
    return [group.key, reset ? undefined : (value as unknown as ClipTransform)];
  });
  return { props, groups };
}
