import { MICROS_PER_SECOND, type Micros } from "@/core";
import { SNAP_PX } from "@/modules/timeline";
import { timeOfContent, type Clip } from "@/modules/project";
import type { KeyRef } from "../keyframe.types";
import { refId } from "./picking";

/**
 * Where a move of keys by `delta` lands once it snaps: the delta that brings a moving key onto the
 * closest target within `SNAP_PX`, else one that puts the first moving key on a whole frame.
 * Times are timeline times. The result is not clamped; the caller clamps it again.
 */
export function snapMove(
  delta: Micros,
  moving: readonly Micros[],
  targets: readonly Micros[],
  pxPerSecond: number,
  frame: Micros,
): Micros {
  const reach = (SNAP_PX / pxPerSecond) * MICROS_PER_SECOND;
  let best: Micros | undefined;
  let nearest = Infinity;
  for (const time of moving) {
    for (const target of targets) {
      const wanted = target - time;
      const off = Math.abs(wanted - delta);
      if (off <= reach && off < nearest) {
        nearest = off;
        best = wanted;
      }
    }
  }
  if (best !== undefined) return best;
  const first = moving[0];
  if (first === undefined || frame <= 0) return delta;
  return Math.round((first + delta) / frame) * frame - first;
}

/**
 * What dragged keys snap to: the playhead, the ends of the clips that hold them and those clips'
 * keys that aren't being dragged. Timeline times.
 */
export function snapTargets(
  clips: Readonly<Record<string, Clip>>,
  dragged: readonly KeyRef[],
  playhead: Micros,
): Micros[] {
  const moving = new Set(dragged.map(refId));
  const targets = new Set<Micros>([playhead]);
  for (const clipId of new Set(dragged.map((ref) => ref.clipId))) {
    const clip = clips[clipId];
    if (!clip) continue;
    targets.add(clip.start);
    targets.add(clip.start + clip.duration);
    for (const [path, track] of Object.entries(clip.animation ?? {})) {
      for (const key of track.keys) {
        if (!moving.has(refId({ clipId, path, keyId: key.id }))) {
          targets.add(timeOfContent(clip, key.t));
        }
      }
    }
  }
  return [...targets];
}
