import type { DrawEnv } from "@/modules/element";
import { textLayout } from "./logic/layout";
import type { TextProps, TextStyle } from "./text.types";

/** `#rrggbb` and an opacity as a CSS `rgba()` color. */
function rgba(hex: string, opacity: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/** The style to draw with: the font is swapped for Inter until its face is ready. */
function drawnStyle(style: TextStyle, ensureFont: DrawEnv["ensureFont"]): TextStyle {
  const ready = ensureFont({
    family: style.font.family,
    source: style.font.source,
    weight: style.weight,
    style: style.italic ? "italic" : "normal",
  });
  return ready ? style : { ...style, font: { family: "Inter", source: "bundled" } };
}

/** Draws one line with the current fill/stroke; letter by letter when the canvas has no letter spacing. */
function paintLine(
  ctx: CanvasRenderingContext2D,
  native: boolean,
  stroke: boolean,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
): void {
  if (native) {
    if (stroke) ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    return;
  }
  let at = x;
  for (const letter of text) {
    if (stroke) ctx.strokeText(letter, at, y);
    else ctx.fillText(letter, at, y);
    at += ctx.measureText(letter).width + letterSpacing;
  }
}

/**
 * Draws a text clip from its layout: background, then each line with shadow, outline and fill.
 * The box sits where `env.placement` says (from `textLayout` and `clipPlacement(…, "none")`, the
 * same as the canvas tools hit-test). A font that is not loaded yet is drawn as Inter, at the
 * clip's scale.
 */
export function drawText(ctx: CanvasRenderingContext2D, props: TextProps, env: DrawEnv): void {
  const { placement: place, kx, ky } = env;
  const used = drawnStyle(props, env.ensureFont);
  const layout = textLayout(props.text, used, env.measure);
  // The clip's own scale: the placed size over the natural size of the requested font.
  const scale = place.width / textLayout(props.text, props, env.measure).box.width;

  ctx.save();
  ctx.setTransform(kx, 0, 0, ky, 0, 0);
  ctx.translate(place.cx, place.cy);
  ctx.rotate((place.rotation * Math.PI) / 180);
  ctx.scale(scale, scale);

  const native = "letterSpacing" in ctx;
  const { background, outline, shadow, fill } = used;
  if (background.enabled) {
    ctx.globalAlpha = background.opacity;
    ctx.fillStyle = background.color;
    ctx.beginPath();
    ctx.roundRect(
      -layout.box.width / 2,
      -layout.box.height / 2,
      layout.box.width,
      layout.box.height,
      background.radius,
    );
    ctx.fill();
  }

  ctx.font = layout.font;
  if (native) ctx.letterSpacing = `${used.letterSpacing}px`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  // Shadow sizes are in canvas pixels, not affected by the transform.
  const angle = (shadow.angle * Math.PI) / 180;
  const shadowPass = () => {
    ctx.shadowColor = rgba(shadow.color, shadow.opacity);
    ctx.shadowBlur = shadow.blur * kx * scale;
    ctx.shadowOffsetX = Math.cos(angle) * shadow.distance * kx * scale;
    ctx.shadowOffsetY = Math.sin(angle) * shadow.distance * ky * scale;
  };
  const noShadow = () => {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };
  for (const line of layout.lines) {
    if (line.text === "") continue;
    let shadowed = !shadow.enabled;
    if (outline.enabled && outline.width > 0) {
      if (!shadowed) shadowPass();
      shadowed = true;
      ctx.globalAlpha = 1;
      ctx.lineWidth = outline.width;
      ctx.strokeStyle = outline.color;
      paintLine(ctx, native, true, line.text, line.x, line.y, used.letterSpacing);
      noShadow();
    }
    if (!shadowed) shadowPass();
    ctx.globalAlpha = fill.opacity;
    ctx.fillStyle = fill.color;
    paintLine(ctx, native, false, line.text, line.x, line.y, used.letterSpacing);
    noShadow();
  }
  ctx.restore();
}
