import {
  clipPlacement,
  textLayout,
  textStyleOf,
  type ClipTransform,
  type ProjectFormat,
  type TextClip,
} from "@/modules/project";

/** `#rrggbb` and an opacity as a CSS `rgba()` color. */
function rgba(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/**
 * Draws a text clip's fill (and a shadow) from its layout. `kx`/`ky` are canvas pixels per output
 * pixel. The box comes from `textLayout` and `clipPlacement(…, "none")`, the same as the canvas
 * tools hit-test. Outline, background and the full shadow come later.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  format: ProjectFormat,
  clip: TextClip,
  transform: ClipTransform,
  kx: number,
  ky: number,
): void {
  const style = textStyleOf(clip, format);
  const layout = textLayout(clip.text, style, (text, f, letterSpacing) => {
    ctx.font = f;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${letterSpacing}px`;
    return ctx.measureText(text).width;
  });
  const place = clipPlacement(format, layout.box, transform, "none");
  const scale = place.width / layout.box.width;

  ctx.save();
  ctx.setTransform(kx, 0, 0, ky, 0, 0);
  ctx.translate(place.cx, place.cy);
  ctx.rotate((place.rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.font = layout.font;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${style.letterSpacing}px`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = style.fill.color;
  ctx.globalAlpha *= style.fill.opacity;
  if (style.shadow.enabled) {
    // Shadow sizes are in canvas pixels, not affected by the transform.
    ctx.shadowColor = rgba(style.shadow.color, style.shadow.opacity);
    ctx.shadowBlur = style.shadow.blur * kx * scale;
    ctx.shadowOffsetY = style.shadow.distance * ky * scale;
  }
  for (const line of layout.lines) ctx.fillText(line.text, line.x, line.y);
  ctx.restore();
}
