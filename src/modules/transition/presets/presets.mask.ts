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

/** Draws `a`, then `b` masked by `gradient` (its alpha decides where `b` shows) over the whole frame. */
export function revealThrough(
  ctx: CanvasRenderingContext2D,
  a: CanvasImageSource,
  b: CanvasImageSource,
  gradient: CanvasGradient,
): void {
  const { width, height } = ctx.canvas;
  const { surface, mask } = maskableSurface(b, width, height);
  mask.save();
  mask.globalCompositeOperation = "destination-in";
  mask.globalAlpha = 1;
  mask.fillStyle = gradient;
  mask.fillRect(0, 0, width, height);
  mask.restore();
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(a, 0, 0, width, height);
  ctx.drawImage(surface, 0, 0, width, height);
  ctx.restore();
}

/** Draws `a`, then `b` over it at alpha `amount` (a plain cross dissolve). */
export function drawDissolve(
  ctx: CanvasRenderingContext2D,
  a: CanvasImageSource,
  b: CanvasImageSource,
  amount: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(a, 0, 0, width, height);
  ctx.globalAlpha = Math.min(1, Math.max(0, amount));
  ctx.drawImage(b, 0, 0, width, height);
  ctx.restore();
}

/** Draws exactly one source over the whole frame (progress 0 or 1). */
export function drawOnly(ctx: CanvasRenderingContext2D, source: CanvasImageSource): void {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();
}
