import type {
  Clip,
  ClipFit,
  ClipPlacement,
  ClipTransform,
  PictureSize,
  ProjectFormat,
} from "./project.types";

/** A clip that hasn't been moved: fitted and centered. */
export const IDENTITY_TRANSFORM: Readonly<ClipTransform> = Object.freeze({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
});

/** The clip's transform, or the identity when it has none. */
export function clipTransform(clip: Clip): ClipTransform {
  return clip.transform ?? IDENTITY_TRANSFORM;
}

/** Brings an angle in degrees into (-180, 180]. */
export function normalizeRotation(degrees: number): number {
  const turned = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return turned === -180 ? 180 : turned;
}

/** The fit of a clip's picture. */
export function clipFit(clip: Clip): ClipFit {
  return clip.kind === "text" ? "none" : "contain";
}

/**
 * Where a picture of `source` size lands in the `format` frame with `transform` applied. Used by
 * the preview engine to draw and by the canvas tools to hit-test, so both always agree.
 */
export function clipPlacement(
  format: ProjectFormat,
  source: PictureSize,
  transform: ClipTransform,
  fit: ClipFit = "contain",
): ClipPlacement {
  const scale =
    fit === "contain" ? Math.min(format.width / source.width, format.height / source.height) : 1;
  return {
    cx: format.width / 2 + transform.x,
    cy: format.height / 2 + transform.y,
    width: source.width * scale * transform.scale,
    height: source.height * scale * transform.scale,
    rotation: transform.rotation,
  };
}
