import type { Micros } from "@/core";
import {
  mergeTextStyle,
  textBox,
  textStyleOf,
  type MediaId,
  type PictureSize,
  type ProjectState,
  type TextMeasure,
} from "@/modules/project";
import type { TextOverride } from "@/modules/preview";
import type { VisibleLayer } from "../transform.types";

/**
 * Pictures on screen at `time` (video clips and text), top-most first (the order to hit-test
 * in). Video clips whose picture size isn't known yet are left out; text is measured.
 */
export function visibleLayers(
  state: ProjectState,
  sizeOf: (mediaId: MediaId) => PictureSize | undefined,
  time: Micros,
  measure: TextMeasure,
  liveText: (clipId: string) => TextOverride | undefined = () => undefined,
): VisibleLayer[] {
  const layers: VisibleLayer[] = [];
  for (const trackId of state.trackOrder) {
    const track = state.tracks[trackId];
    if (!track || track.kind !== "video" || track.hidden) continue;
    for (const clipId of track.clipIds) {
      const clip = state.clips[clipId];
      if (!clip) continue;
      if (clip.start > time) break; // sorted by start
      if (time >= clip.start + clip.duration) continue;
      if (clip.kind === "text") {
        const live = liveText(clipId);
        const shown = live
          ? {
              ...clip,
              text: live.text ?? clip.text,
              style: live.style
                ? mergeTextStyle(textStyleOf(clip, state.format), live.style)
                : clip.style,
            }
          : clip;
        layers.push({ clipId, source: textBox(state.format, shown, measure), fit: "none" });
        continue;
      }
      if (state.media[clip.mediaId]?.kind !== "video") continue;
      const source = sizeOf(clip.mediaId);
      if (source) layers.push({ clipId, source, fit: "contain" });
    }
  }
  return layers;
}
