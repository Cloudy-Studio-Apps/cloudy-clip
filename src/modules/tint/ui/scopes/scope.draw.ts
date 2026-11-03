import { chroma, histogram, luma } from "../../logic/scopes";
import type { DrawnScope } from "./scopes.types";

/** Trace colors (data, not theme): red, green, blue and luma. */
const TRACES = ["rgba(255,80,70,.13)", "rgba(80,230,110,.13)", "rgba(80,140,255,.15)"] as const;
const LUMA = "rgba(180,230,190,.11)";
const FILLS = ["rgba(255,80,70,.45)", "rgba(80,230,110,.45)", "rgba(80,140,255,.5)"] as const;

/** Paints one scope of `pixels` on `ctx`, `width × height` device pixels, with `grid` as the graticule color. */
export function drawScope(
  ctx: CanvasRenderingContext2D,
  kind: DrawnScope,
  pixels: ImageData,
  width: number,
  height: number,
  grid: string,
): void {
  const { data, width: w } = pixels;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  if (kind === "vector") {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 8;
    for (const share of [1, 0.5]) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * share, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(232,184,107,.6)";
    const skin = (-123 * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(skin) * radius, cy + Math.sin(skin) * radius);
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(200,240,210,.14)";
    for (let i = 0; i < data.length; i += 4) {
      const [cb, cr] = chroma(data[i]!, data[i + 1]!, data[i + 2]!);
      ctx.fillRect(cx + cb * radius * 1.6, cy - cr * radius * 1.6, 1.5, 1.5);
    }
    return;
  }
  for (let g = 0; g <= 4; g++) {
    const y = Math.round(6 + ((height - 12) * g) / 4) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  if (kind === "hist") {
    histogram(data).forEach((row, c) => {
      ctx.fillStyle = FILLS[c]!;
      ctx.beginPath();
      ctx.moveTo(0, height);
      row.forEach((v, i) =>
        ctx.lineTo((i / (row.length - 1)) * width, height - 4 - (height - 14) * v),
      );
      ctx.lineTo(width, height);
      ctx.fill();
    });
    return;
  }
  ctx.globalCompositeOperation = "lighter";
  const level = (v: number) => 6 + (height - 12) * (1 - v / 255);
  for (let i = 0; i < data.length; i += 4) {
    const x = ((i / 4) % w) / w;
    if (kind === "wave") {
      ctx.fillStyle = LUMA;
      ctx.fillRect(x * width, level(luma(data[i]!, data[i + 1]!, data[i + 2]!)), 1.6, 1.6);
      continue;
    }
    const seg = width / 3;
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = TRACES[c]!;
      ctx.fillRect(c * seg + x * (seg - 4), level(data[i + c]!), 1.6, 1.6);
    }
  }
}
