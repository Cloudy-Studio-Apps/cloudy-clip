import type { Micros } from "@/core";
import { mergeProps, type ElementApi, type TextMeasure } from "@/modules/element";
import {
  clipTransform,
  type ClipTransform,
  type Composition,
  type MediaId,
  type PictureSize,
  type ProjectState,
} from "@/modules/project";
import type { TransformField, VisibleLayer } from "../transform.types";

/**
 * Pictures on screen at `time` (media clips and elements that draw themselves), top-most first (the order to hit-test
 * in). Video clips whose picture size isn't known yet are left out; text is measured. Elements
 * without the transform group can't be moved on the canvas, so they are left out too.
 */
export function visibleLayers(
  state: ProjectState,
  composition: Composition,
  elements: Pick<ElementApi, "get" | "resolve">,
  sizeOf: (mediaId: MediaId) => PictureSize | undefined,
  time: Micros,
  measure: TextMeasure,
  liveProps: (clipId: string) => Record<string, unknown> | undefined = () => undefined,
): VisibleLayer[] {
  const layers: VisibleLayer[] = [];
  for (const trackId of composition.trackOrder) {
    const track = state.tracks[trackId];
    if (!track || track.kind !== "video" || track.hidden) continue;
    for (const clipId of track.clipIds) {
      const clip = state.clips[clipId];
      if (!clip) continue;
      if (clip.start > time) break; // sorted by start
      if (time >= clip.start + clip.duration) continue;
      const element = elements.get(clip.kind);
      const picture = element?.definition.picture;
      const group = element?.groups.find((g) => g.id === "transform");
      if (!picture || !group) continue;
      const fields = new Set(Object.keys(group.properties) as TransformField[]);
      const live = liveProps(clipId);
      const transform = clipTransform(clip, live?.transform as Partial<ClipTransform> | undefined);
      if (picture.source === "media") {
        if (!clip.mediaId || state.media[clip.mediaId]?.kind !== "video") continue;
        const source = sizeOf(clip.mediaId);
        if (source) layers.push({ clipId, source, fit: picture.fit, transform, fields });
        continue;
      }
      if (!picture.size) continue;
      const saved = elements.resolve(clip, composition.format);
      const props = live ? mergeProps(saved, live) : saved;
      layers.push({
        clipId,
        source: picture.size(props, { format: composition.format, measure }),
        fit: picture.fit,
        transform,
        fields,
      });
    }
  }
  return layers;
}
