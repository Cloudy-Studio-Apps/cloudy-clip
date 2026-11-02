import { IDENTITY_TRANSFORM } from "@/modules/project";
import type { ClipFit, ClipTransform, KeyTrack, ProjectFormat } from "@/modules/project";

/**
 * Keeps a picture in the same proportion of the frame when the frame changes size. A `contain`
 * picture keeps its scale, because it already refits to the new frame; a picture at its natural
 * size scales by the smaller ratio.
 */
export function scaleTransform(
  transform: ClipTransform,
  fit: ClipFit,
  before: ProjectFormat,
  after: ProjectFormat,
): ClipTransform {
  const kx = after.width / before.width;
  const ky = after.height / before.height;
  return {
    ...transform,
    x: transform.x * kx,
    y: transform.y * ky,
    scale: fit === "none" ? transform.scale * Math.min(kx, ky) : transform.scale,
  };
}

const SCALED = ["x", "y", "scale"] as const;

/**
 * The key tracks with the values of `transform.x`, `transform.y` and `transform.scale` scaled like
 * `scaleTransform` scales the static ones; undefined when the clip has none of them.
 */
export function scaleKeys(
  animation: Record<string, KeyTrack> | undefined,
  fit: ClipFit,
  before: ProjectFormat,
  after: ProjectFormat,
): Record<string, KeyTrack> | undefined {
  if (!animation) return undefined;
  const scaled: Record<string, KeyTrack> = {};
  for (const field of SCALED) {
    const track = animation[`transform.${field}`];
    if (!track) continue;
    scaled[`transform.${field}`] = {
      ...track,
      keys: track.keys.map((key) => ({
        ...key,
        value: scaleTransform(
          { ...IDENTITY_TRANSFORM, [field]: key.value as number },
          fit,
          before,
          after,
        )[field],
      })),
    };
  }
  return Object.keys(scaled).length > 0 ? { ...animation, ...scaled } : undefined;
}
