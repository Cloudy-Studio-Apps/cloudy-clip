import type { Micros } from "@/core";
import { mergeProps, type ElementApi, type TextMeasure } from "@/modules/element";
import {
  animatedClip,
  clipTransform,
  followedClip,
  matteTracks,
  type ClipTransform,
  type FollowLive,
  type FollowShift,
  type Composition,
  type MediaId,
  type PictureSize,
  type ProjectState,
} from "@/modules/project";
import type { TransformField, VisibleLayer } from "../transform.types";

/** What the path adds to a follower (`placed` minus `offset`), or undefined when nothing. */
function shiftOf(placed: ClipTransform, offset: ClipTransform): FollowShift | undefined {
  const shift = {
    x: placed.x - offset.x,
    y: placed.y - offset.y,
    rotation: placed.rotation - offset.rotation,
  };
  return shift.x || shift.y || shift.rotation ? shift : undefined;
}

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
  const mattes = matteTracks(state, composition);
  for (const trackId of composition.trackOrder) {
    const track = state.tracks[trackId];
    if (!track || track.kind !== "video" || track.hidden) continue;
    for (const clipId of track.clipIds) {
      const saved = state.clips[clipId];
      if (!saved || saved.disabled) continue;
      if (saved.start > time) break; // sorted by start
      if (time >= saved.start + saved.duration) continue;
      const live = liveProps(clipId);
      // On a path: the box sits where the picture is drawn; `shift` is what the path adds, so a
      // drag commits the offset the clip stores.
      const clip = followedClip(saved, time, state.paths, live as FollowLive | undefined);
      const element = elements.get(clip.kind);
      const picture = element?.definition.picture;
      const group = element?.groups.find((g) => g.id === "transform");
      if (!picture || !group) continue;
      const fields = new Set(Object.keys(group.properties) as TransformField[]);
      const transform = clipTransform(clip);
      const offset = clip.follow?.pathId
        ? clipTransform(animatedClip(saved, time), live?.transform as Partial<ClipTransform>)
        : transform;
      const shift = shiftOf(transform, offset);
      const matteMark = mattes.has(trackId) ? ({ matte: true } as const) : {};
      if (picture.source === "media") {
        if (!clip.mediaId || state.media[clip.mediaId]?.kind === "audio") continue;
        const source = sizeOf(clip.mediaId);
        if (source)
          layers.push({ clipId, source, fit: picture.fit, transform, fields, shift, ...matteMark });
        continue;
      }
      if (picture.source === "composition") {
        const placed = clip.compositionRef && state.compositions[clip.compositionRef];
        if (placed) {
          const { width, height } = placed.format;
          const source = { width, height };
          layers.push({ clipId, source, fit: picture.fit, transform, fields, shift, ...matteMark });
        }
        continue;
      }
      if (!picture.size) continue;
      const resolved = elements.resolve(clip, composition.format);
      const props = live ? mergeProps(resolved, live) : resolved;
      layers.push({
        clipId,
        source: picture.size(props, { format: composition.format, measure }),
        fit: picture.fit,
        transform,
        fields,
        shift,
        ...matteMark,
      });
    }
  }
  return layers;
}
