import type { Micros } from "@/core";
import type { Clip, ClipId } from "@/modules/project";

/**
 * The clips the blade cuts at `at`: the clip clicked, or with Shift every clip that has `at`
 * inside it. Edges don't count, the split command refuses a piece shorter than a frame.
 */
export function bladeTargets(
  clips: readonly Clip[],
  hit: Clip | null,
  at: Micros,
  every: boolean,
): ClipId[] {
  if (!every) return hit ? [hit.id] : [];
  return clips.filter((c) => c.start < at && at < c.start + c.duration).map((c) => c.id);
}

/** Which edge of a clip a press drags a fade from: the nearer half, left is the fade-in. */
export function fadeEdgeAt(clientX: number, box: { left: number; width: number }): "in" | "out" {
  return clientX < box.left + box.width / 2 ? "in" : "out";
}
