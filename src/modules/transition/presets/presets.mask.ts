/**
 * A 2D context to mask `b` with `destination-in`. In the preview `b` is the engine's own scratch
 * canvas, redrawn every frame, so it is masked in place; any other source (a thumbnail's image)
 * is first drawn into a temporary canvas. No pixel reads.
 */
export function maskableSurface(
  b: CanvasImageSource,
  width: number,
  height: number,
): { surface: CanvasImageSource; mask: CanvasRenderingContext2D } {
  if (
    b instanceof HTMLCanvasElement ||
    (typeof OffscreenCanvas !== "undefined" && b instanceof OffscreenCanvas)
  ) {
    const own = b.getContext("2d") as CanvasRenderingContext2D | null;
    if (own) return { surface: b, mask: own };
  }
  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const mask = tmp.getContext("2d");
  if (!mask) throw new Error("2D canvas unavailable");
  mask.drawImage(b, 0, 0, width, height);
  return { surface: tmp, mask };
}
