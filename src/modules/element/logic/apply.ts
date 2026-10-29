import type { CommandContext } from "@/core";
import type { Clip, ClipTransform, ProjectFormat } from "@/modules/project";
import type { GroupWrites, ResolvedElement } from "../element.types";
import { groupValue } from "./clip";
import { deepEqual, isPlainObject, mergeProps, minimizeProps, resolveProps } from "./values";

/** The clip's stored props after `patch` (normalized, minimized). Shared group keys are skipped. */
export function applyPropsPatch(
  ctx: CommandContext,
  element: ResolvedElement,
  clip: Clip,
  patch: Record<string, unknown>,
  format: ProjectFormat,
): Record<string, unknown> {
  const { definition, groups } = element;
  const own = Object.fromEntries(
    Object.entries(patch).filter(([key]) => !groups.some((g) => g.key === key)),
  );
  const defaults = definition.defaults(format);
  const merged = mergeProps(resolveProps(clip.props ?? {}, defaults), own);
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
  const groups: GroupWrites = [];
  for (const path of paths) {
    const [head, field] = path.split(".") as [string, string | undefined];
    const group = element.groups.find((g) => g.key === head);
    if (group) {
      if (field === undefined) {
        groups.push([group.key, undefined]);
        continue;
      }
      const defaults = group.defaults(format);
      const value = {
        ...mergeProps(defaults, groupValue(clip, group.key)),
        [field]: defaults[field],
      };
      groups.push([
        group.key,
        deepEqual(value, defaults) ? undefined : (value as unknown as ClipTransform),
      ]);
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
  return { props, groups };
}
