import type { Micros } from "@/core";
import { mergeProps, type ElementApi, type TextMeasure } from "@/modules/element";
import {
  clipTransform,
  type ClipTransform,
  type MediaId,
  type PictureSize,
  type ProjectState,
} from "@/modules/project";
import type { VisibleLayer } from "../transform.types";

/**
 * Pictures on screen at `time` (media clips and elements that draw themselves), top-most first (the order to hit-test
 * in). Video clips whose picture size isn't known yet are left out; text is measured.
 */
export function visibleLayers(
  state: ProjectState,
  elements: Pick<ElementApi, "get" | "resolve">,
  sizeOf: (mediaId: MediaId) => PictureSize | undefined,
  time: Micros,
  measure: TextMeasure,
  liveProps: (clipId: string) => Record<string, unknown> | undefined = () => undefined,
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
      const picture = elements.get(clip.kind)?.definition.picture;
      if (!picture) continue;
      const live = liveProps(clipId);
      const transform = clipTransform(clip, live?.transform as Partial<ClipTransform> | undefined);
      if (picture.source === "media") {
        if (!clip.mediaId || state.media[clip.mediaId]?.kind !== "video") continue;
        const source = sizeOf(clip.mediaId);
        if (source) layers.push({ clipId, source, fit: picture.fit, transform });
        continue;
      }
      if (!picture.size) continue;
      const saved = elements.resolve(clip, state.format);
      const props = live ? mergeProps(saved, live) : saved;
      layers.push({
        clipId,
        source: picture.size(props, { format: state.format, measure }),
        fit: picture.fit,
        transform,
      });
    }
  }
  return layers;
}
