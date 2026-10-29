import type { Micros } from "@/core";
import { mergeProps, type ElementApi, type TextMeasure } from "@/modules/element";
import type { MediaId, PictureSize, ProjectState } from "@/modules/project";
import type { TextOverride } from "@/modules/preview";
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
      const picture = elements.get(clip.kind)?.definition.picture;
      if (!picture) continue;
      if (picture.source === "media") {
        if (!clip.mediaId || state.media[clip.mediaId]?.kind !== "video") continue;
        const source = sizeOf(clip.mediaId);
        if (source) layers.push({ clipId, source, fit: picture.fit });
        continue;
      }
      if (!picture.size) continue;
      const live = liveText(clipId);
      const saved = elements.resolve(clip, state.format);
      const props = live
        ? mergeProps(saved, { ...live.style, ...(live.text !== undefined && { text: live.text }) })
        : saved;
      layers.push({
        clipId,
        source: picture.size(props, { format: state.format, measure }),
        fit: picture.fit,
      });
    }
  }
  return layers;
}
