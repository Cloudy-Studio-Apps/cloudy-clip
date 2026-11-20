import { maskLine, maskOutline, type ClipMask, type MaskMapping } from "@/modules/project";

/** Far enough along a line, in mask px, to leave the picture: a half-plane as a polygon. */
const FAR = 100_000;

/** Fills a linear mask's half-plane or a mirror's band, its edges moved out by the expansion. */
function fillLine(s: CanvasRenderingContext2D, mask: ClipMask): void {
  const line = maskLine(mask);
  if (!line) return;
  const e = mask.expansion;
  const near = line.half > 0 ? -(line.half + e) : -e;
  const far = line.half > 0 ? line.half + e : FAR;
  if (far <= near) return;
  const { x, y, nx, ny } = line;
  const at = (d: number, t: number) => s.lineTo(x + nx * d - ny * t, y + ny * d + nx * t);
  s.beginPath();
  at(near, -FAR);
  at(near, FAR);
  at(far, FAR);
  at(far, -FAR);
  s.fill();
}

/**
 * One mask's shape, opaque, on `s` (cleared first): its outline through `mapping` × `kx`/`ky`,
 * grown or shrunk by a round-joined stroke of the expansion, then inverted when `invert`.
 */
export function rasterize(
  s: CanvasRenderingContext2D,
  mask: ClipMask,
  { cx, cy, rotation, sx, sy }: MaskMapping,
  kx: number,
  ky: number,
  invert: boolean,
): void {
  const { width, height } = s.canvas;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(0, 0, width, height);
  s.setTransform(kx, 0, 0, ky, 0, 0);
  s.translate(cx, cy);
  s.rotate((rotation * Math.PI) / 180);
  s.scale(sx, sy);
  s.fillStyle = "#fff";
  s.strokeStyle = "#fff";
  const outline = maskOutline(mask);
  if (outline) {
    s.beginPath();
    const start = outline[0]?.[0];
    if (start) s.moveTo(start.x, start.y);
    for (const [, a, b, end] of outline) s.bezierCurveTo(a.x, a.y, b.x, b.y, end.x, end.y);
    s.closePath();
    s.fill();
    if (mask.expansion !== 0) {
      // The path stays where it was traced; the stroke's width is in canvas px.
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.lineWidth = 2 * Math.abs(mask.expansion) * Math.min(Math.abs(sx) * kx, Math.abs(sy) * ky);
      s.lineJoin = "round";
      s.globalCompositeOperation = mask.expansion > 0 ? "source-over" : "destination-out";
      s.stroke();
    }
  } else fillLine(s, mask);
  s.setTransform(1, 0, 0, 1, 0, 0);
  if (invert) {
    s.globalCompositeOperation = "xor";
    s.fillRect(0, 0, width, height);
  }
  s.globalCompositeOperation = "source-over";
}
