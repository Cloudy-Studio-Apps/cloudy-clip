import type { ClipFit, ClipTransform, ProjectFormat } from "@/modules/project";

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
