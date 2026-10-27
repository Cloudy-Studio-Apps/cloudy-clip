import {
  TEXT_STYLE,
  clipPlacement,
  textBox,
  textFont,
  textFontSize,
  type ClipTransform,
  type ProjectFormat,
  type TextClip,
} from "@/modules/project";

/**
 * Draws a text clip in the default style. `kx`/`ky` are canvas pixels per output pixel. The box
 * comes from `textBox` and `clipPlacement(…, "none")`, the same as the canvas tools hit-test.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  format: ProjectFormat,
  clip: TextClip,
  transform: ClipTransform,
  kx: number,
  ky: number,
): void {
  const font = textFont(format);
  const box = textBox(format, clip.text, (text, f) => {
    ctx.font = f;
    return ctx.measureText(text).width;
  });
  const place = clipPlacement(format, box, transform, "none");
  const scale = place.width / box.width;
  const size = textFontSize(format);

  ctx.save();
  ctx.setTransform(kx, 0, 0, ky, 0, 0);
  ctx.translate(place.cx, place.cy);
  ctx.rotate((place.rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = TEXT_STYLE.color;
  // Shadow sizes are in canvas pixels, not affected by the transform.
  ctx.shadowColor = TEXT_STYLE.shadow;
  ctx.shadowBlur = size * 0.08 * kx * scale;
  ctx.shadowOffsetY = size * 0.03 * ky * scale;
  ctx.fillText(clip.text, 0, 0);
  ctx.restore();
}
