import { IDENTITY_TRANSFORM, type ClipTransform, type FollowShift } from "@/modules/project";

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

/**
 * A transform drawn on a motion path back in the clip's own terms: the path's `shift` taken off
 * its position and rotation, since a follower stores its offset from the path.
 */
export function unshift(transform: ClipTransform, shift: FollowShift | undefined): ClipTransform {
  if (!shift) return transform;
  return {
    ...transform,
    x: transform.x - shift.x,
    y: transform.y - shift.y,
    rotation: transform.rotation - shift.rotation,
  };
}
