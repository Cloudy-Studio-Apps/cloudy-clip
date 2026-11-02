import { timeOfContent, type Clip } from "@/modules/project";
import type { KeySpan, KeyRef } from "../keyframe.types";

/** The earliest and latest time of the selected keys, in timeline time; undefined with none. */
export function selectionSpan(
  clips: Readonly<Record<string, Clip>>,
  selection: readonly KeyRef[],
): KeySpan | undefined {
  let start = Infinity;
  let end = -Infinity;
  for (const ref of selection) {
    const clip = clips[ref.clipId];
    const key = clip?.animation?.[ref.path]?.keys.find((k) => k.id === ref.keyId);
    if (!clip || !key) continue;
    const time = timeOfContent(clip, key.t);
    start = Math.min(start, time);
    end = Math.max(end, time);
  }
  return end < start ? undefined : { start, end };
}

/**
 * The factor a stretch drag asks for: the grabbed end follows the pointer, the other end stays.
 * Zero when the pointer reaches the fixed end, since a factor of 0 isn't allowed.
 */
export function stretchFactor(anchor: number, grabbed: number, pointer: number): number {
  const span = grabbed - anchor;
  return span === 0 ? 1 : (pointer - anchor) / span;
}
