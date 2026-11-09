import type { ClipPlacement, PictureSize } from "@/modules/project";

/**
 * The size a picture's GPU passes run at in the live preview: its own size, or smaller when it
 * lands smaller on the canvas (`kx`, `ky` are canvas pixels per output pixel), aspect kept. A
 * picture never runs larger than it is.
 */
export function cappedPassSize(
  size: PictureSize,
  place: ClipPlacement,
  kx: number,
  ky: number,
): PictureSize {
  const across = Math.abs(place.width * kx) / size.width;
  const down = Math.abs(place.height * ky) / size.height;
  const ratio = Math.min(1, Math.max(across, down));
  if (ratio >= 1) return size;
  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
  };
}
