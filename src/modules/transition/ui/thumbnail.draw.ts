import type { SampleColors } from "../transition.types";

/** Colors from the design tokens (`--clip-video`, `--clip-type`), with plain fallbacks. */
export function sampleColors(): SampleColors {
  const style = getComputedStyle(document.documentElement);
  return {
    a: style.getPropertyValue("--clip-video").trim() || "#2f5f9a",
    b: style.getPropertyValue("--clip-type").trim() || "#a85a3c",
  };
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
