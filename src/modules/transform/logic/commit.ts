import { IDENTITY_TRANSFORM, type ClipTransform } from "@/modules/project";

/** Every field of a clip's transform, in the identity's order. */
export const TRANSFORM_KEYS = Object.keys(IDENTITY_TRANSFORM) as (keyof ClipTransform)[];

/**
 * What a canvas gesture commits: the fields that changed from `start` to `current` and that the
 * clip's element supports (`fields`), or null when there are none.
 */
export function transformPatch(
  start: ClipTransform,
  current: ClipTransform,
  fields: ReadonlySet<string>,
): Partial<ClipTransform> | null {
  const patch: Partial<ClipTransform> = {};
  for (const key of TRANSFORM_KEYS) {
    if (fields.has(key) && current[key] !== start[key]) patch[key] = current[key];
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
