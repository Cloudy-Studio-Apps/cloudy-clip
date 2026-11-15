import {
  HIST_BINS,
  LEVELS,
  PARADE_COLUMNS,
  SKIN_LINE,
  VECTOR_SIDE,
  WAVE_COLUMNS,
  scopeData,
} from "../../logic/scopes";
import type { ScopePainter } from "./scopes.types";

/** Trace colors (data, not theme): red, green and blue, then luma and the vectorscope's trace. */
const CHANNELS = [
  [255, 80, 70],
  [80, 230, 110],
  [80, 140, 255],
] as const;
const LUMA = [180, 230, 190] as const;
const CHROMA = [200, 240, 210] as const;
const FILLS = ["rgba(255,80,70,.45)", "rgba(80,230,110,.45)", "rgba(80,140,255,.5)"] as const;
const SKIN = "rgba(232,184,107,.6)";

/** A painter with a scratch canvas of its own for the binned traces. */
export function createScopePainter(): ScopePainter {
  const scratch = document.createElement("canvas");

  /** Draws a 0..1 grid scaled into `dest`, colored by `tint(column)`. */
  const traces = (
    ctx: CanvasRenderingContext2D,
    grid: Float32Array,
    cols: number,
    rows: number,
    tint: (col: number) => readonly [number, number, number],
    dest: [number, number, number, number],
  ) => {
    scratch.width = cols;
    scratch.height = rows;
    const sctx = scratch.getContext("2d");
    if (!sctx) return;
    const image = sctx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = grid[y * cols + x]!;
        if (v === 0) continue;
        const [r, g, b] = tint(x);
        const i = (y * cols + x) * 4;
        image.data[i] = r;
        image.data[i + 1] = g;
        image.data[i + 2] = b;
        image.data[i + 3] = Math.round(v * 255);
      }
    }
    sctx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(scratch, ...dest);
  };

  return (ctx, kind, frame, width, height, grid) => {
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
      ctx.strokeStyle = SKIN;
      const skin = (-SKIN_LINE * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(skin) * radius, cy + Math.sin(skin) * radius);
      ctx.stroke();
      if (!frame) return;
      const half = radius * 1.6;
      traces(ctx, scopeData(frame, "vector"), VECTOR_SIDE, VECTOR_SIDE, () => CHROMA, [
        cx - half,
        cy - half,
        half * 2,
        half * 2,
      ]);
      return;
    }
    for (let g = 0; g <= 4; g++) {
      const y = Math.round(6 + ((height - 12) * g) / 4) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    if (!frame) return;
    const data = scopeData(frame, kind);
    if (kind === "hist") {
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = FILLS[c]!;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let i = 0; i < HIST_BINS; i++) {
          const v = data[c * HIST_BINS + i]!;
          ctx.lineTo((i / (HIST_BINS - 1)) * width, height - 4 - (height - 14) * v);
        }
        ctx.lineTo(width, height);
        ctx.fill();
      }
      return;
    }
    const dest: [number, number, number, number] = [0, 6, width, height - 12];
    if (kind === "wave") {
      traces(ctx, data, WAVE_COLUMNS, LEVELS, () => LUMA, dest);
      return;
    }
    traces(
      ctx,
      data,
      PARADE_COLUMNS * 3,
      LEVELS,
      (col) => CHANNELS[Math.floor(col / PARADE_COLUMNS)]!,
      dest,
    );
  };
}
