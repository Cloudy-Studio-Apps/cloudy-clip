/**
 * Draws `source` full-frame, scaled by `scale` and turned by `angle` radians about the center, then
 * moved by (`dx`, `dy`). The 8 tiles around it, each flipped across the shared edge, are drawn
 * under the same transform, so the frame is always covered ("mirror edges"). The identity draws
 * the picture alone.
 */
export function drawMoved(
  target: CanvasRenderingContext2D,
  source: CanvasImageSource,
  scale: number,
  angle: number,
  dx = 0,
  dy = 0,
): void {
  const { width, height } = target.canvas;
  const still = scale === 1 && angle === 0 && dx === 0 && dy === 0;
  target.save();
  target.translate(width / 2 + dx, height / 2 + dy);
  target.rotate(angle);
  target.scale(scale, scale);
  for (let iy = -1; iy <= 1; iy++) {
    for (let ix = -1; ix <= 1; ix++) {
      if (still && (ix || iy)) continue;
      target.save();
      target.translate(ix * width, iy * height);
      target.scale(ix ? -1 : 1, iy ? -1 : 1);
      target.drawImage(source, -width / 2, -height / 2, width, height);
      target.restore();
    }
  }
  target.restore();
}
