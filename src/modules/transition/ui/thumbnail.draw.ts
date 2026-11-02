import type { SampleColors } from "../transition.types";

/** Colors of the sample pictures. Fixed, so a thumbnail needs no redraw when the theme changes. */
export function sampleColors(): SampleColors {
  return { a: "#24384a", b: "#4d4119" };
}

/** Draws a sample picture (a diagonal gradient with a circle or a square) over the whole canvas. */
export function drawSample(
  ctx: CanvasRenderingContext2D,
  color: string,
  shape: "circle" | "square",
): void {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "#101418");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  const size = height * 0.34;
  if (shape === "circle") ctx.arc(width / 2, height / 2, size, 0, Math.PI * 2);
  else ctx.rect(width / 2 - size, height / 2 - size, size * 2, size * 2);
  ctx.fill();
  ctx.restore();
}
