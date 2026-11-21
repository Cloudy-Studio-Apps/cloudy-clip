import { orderedMasks, type Clip, type ClipMask, type MaskId } from "@/modules/project";

/** A clip's enabled masks in order, with a drag's live values (`previewProps`' `masks`) over them. */
export function liveMasks(
  clip: Clip,
  live: Record<MaskId, Partial<ClipMask>> | undefined,
): ClipMask[] {
  return orderedMasks(clip).flatMap((mask) => {
    const patch = live?.[mask.id];
    const merged = patch
      ? ({ ...mask, ...patch, shape: { ...mask.shape, ...patch.shape } } as ClipMask)
      : mask;
    return merged.on === false ? [] : [merged];
  });
}
