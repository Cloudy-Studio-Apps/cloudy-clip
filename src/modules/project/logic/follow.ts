import type { Draft } from "immer";
import { createId, type Micros } from "@/core";
import { clipTransform } from "../project.geometry";
import type {
  Clip,
  ClipFollow,
  ClipId,
  CompositionId,
  FollowShift,
  KeyTrack,
  MotionPath,
  PathId,
  ProjectState,
} from "../project.types";
import { animatedClip } from "./animate";
import { clampToClip } from "./content";
import { pathPointAt } from "./path";

/** A clip that follows no path: what the `follow` group holds by default. */
export const NO_FOLLOW: ClipFollow = { pathId: "", progress: 0, orient: false };

/**
 * What following its path adds to a clip's transform, read from the clip as it is (pass an
 * animated clip for a moment). Null when it follows nothing or its path is missing.
 */
export function followShift(clip: Clip, paths: ProjectState["paths"]): FollowShift | null {
  const follow = clip.follow;
  const path = follow?.pathId ? paths?.[follow.pathId] : undefined;
  if (!follow || !path) return null;
  const at = pathPointAt(path, Number(follow.progress ?? 0));
  return { x: at.x, y: at.y, rotation: follow.orient ? at.angle : 0 };
}

/**
 * The clip as it is placed at a timeline time: `animatedClip`, then, when it follows a path, its
 * position moved onto the path (its own `x`, `y` being the offset) and, with orient, the path's
 * direction added to its rotation. Every placement of a picture reads clips through this.
 */
export function followedClip(clip: Clip, time: Micros, paths: ProjectState["paths"]): Clip {
  const animated = animatedClip(clip, time);
  const shift = followShift(animated, paths);
  if (!shift) return animated;
  const t = clipTransform(animated);
  return {
    ...animated,
    transform: { ...t, x: t.x + shift.x, y: t.y + shift.y, rotation: t.rotation + shift.rotation },
  };
}

const SHIFTED = {
  "transform.x": "x",
  "transform.y": "y",
  "transform.rotation": "rotation",
} as const;

/**
 * The clip no longer following its path, left where it was at `at` (timeline time, brought into
 * the clip): the path's shift there is added to its static position and rotation and to every
 * key of them, and its follow and Progress keys are dropped.
 */
export function bakeFollow(clip: Clip, paths: ProjectState["paths"], at: Micros): Clip {
  const shift = followShift(animatedClip(clip, clampToClip(clip, at)), paths);
  const animation: Record<string, KeyTrack> = {};
  for (const [path, track] of Object.entries(clip.animation ?? {})) {
    if (path.startsWith("follow.")) continue;
    const field = SHIFTED[path as keyof typeof SHIFTED];
    animation[path] =
      shift && field
        ? {
            ...track,
            keys: track.keys.map((k) => ({ ...k, value: Number(k.value) + shift[field] })),
          }
        : track;
  }
  const baked: Clip = { ...clip };
  delete baked.follow;
  if (Object.keys(animation).length > 0) baked.animation = animation;
  else delete baked.animation;
  if (shift) {
    const t = clipTransform(clip);
    baked.transform = {
      ...t,
      x: t.x + shift.x,
      y: t.y + shift.y,
      rotation: t.rotation + shift.rotation,
    };
  }
  return baked;
}

/**
 * Gives each path those clips follow a copy in `compositionId`, and points the clips at the
 * copies. For clips that moved or were copied into another composition.
 */
export function copyFollowedPaths(
  draft: Draft<ProjectState>,
  clipIds: readonly ClipId[],
  compositionId: CompositionId,
): void {
  const copies = new Map<PathId, PathId>();
  for (const clipId of clipIds) {
    const clip = draft.clips[clipId];
    const pathId = clip?.follow?.pathId;
    const path = pathId ? draft.paths?.[pathId] : undefined;
    if (!clip?.follow || !pathId || !path) continue;
    if (path.compositionId === compositionId) continue;
    if (!copies.has(pathId)) {
      const id = createId("path");
      draft.paths![id] = { ...structuredClone(path as MotionPath), id, compositionId };
      copies.set(pathId, id);
    }
    clip.follow.pathId = copies.get(pathId)!;
  }
}

/** A path stretched like a composition being resized: points and handles scaled by `kx`, `ky`. */
export function scalePath(path: MotionPath, kx: number, ky: number): MotionPath {
  return {
    ...path,
    points: path.points.map((p) => ({
      x: p.x * kx,
      y: p.y * ky,
      inX: p.inX * kx,
      inY: p.inY * ky,
      outX: p.outX * kx,
      outY: p.outY * ky,
    })),
  };
}
