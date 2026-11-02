import type { Clip } from "@/modules/project";
import type { ResolvedElement } from "../element.types";
import { isPlainObject } from "./values";

/**
 * A patch split by what is animated: the leaves whose path is a key track on the clip (`keyed`,
 * by path) and everything else (`rest`). A group left with nothing is dropped from `rest`.
 */
export function splitAnimated(
  clip: Clip,
  patch: Record<string, unknown>,
  element: ResolvedElement,
): { keyed: Map<string, unknown>; rest: Record<string, unknown> } {
  const keyed = new Map<string, unknown>();
  const isGroup = (path: string) =>
    element.fields.get(path)?.kind === "group" || element.groups.some((g) => g.key === path);
  const walk = (values: Record<string, unknown>, prefix: string): Record<string, unknown> => {
    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      const path = prefix + key;
      if (isPlainObject(value) && isGroup(path)) {
        const inner = walk(value, `${path}.`);
        if (Object.keys(inner).length > 0) rest[key] = inner;
      } else if (clip.animation?.[path]) {
        keyed.set(path, value);
      } else {
        rest[key] = value;
      }
    }
    return rest;
  };
  return { keyed, rest: walk(patch, "") };
}
