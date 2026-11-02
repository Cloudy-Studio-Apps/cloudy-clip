import { MICROS_PER_SECOND } from "@/core";
import { clipEnd, contentTime, trackValue } from "@/modules/project";
import { CURVE_COLORS, CURVE_KEY_RADIUS, CURVE_PADDING } from "../keyframe.layout";
import type { CurveScene, ShownCurve } from "../keyframe.types";
import { keyPoint } from "../logic/graph";

/** A curve is sampled at most once per this many px of width. */
const SAMPLE_PX = 2;
/** Grid lines are kept at least this far apart, in px. */
const GRID_MIN_PX = 48;
/** Seconds the grid can step by. */
const GRID_STEPS = [1, 2, 5, 10, 30, 60, 300, 600];

/** A number as the labels show it. */
function label(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Traces one curve over the part of its clip that is in view, one sample per few pixels. */
function trace(ctx: CanvasRenderingContext2D, curve: ShownCurve, scene: CurveScene): void {
  const { pxPerSecond, scrollLeft, width } = scene;
  const { clip, track, scale } = curve;
  const pxOf = (time: number) => (time / MICROS_PER_SECOND) * pxPerSecond - scrollLeft;
  const from = Math.max(0, pxOf(clip.start));
  const to = Math.min(width, pxOf(clipEnd(clip)));
  if (to <= from) return;
  ctx.beginPath();
  let started = false;
  for (let x = from; ; x = Math.min(to, x + SAMPLE_PX)) {
    const time = ((x + scrollLeft) / pxPerSecond) * MICROS_PER_SECOND;
    const value = trackValue(track, contentTime(clip, Math.round(time)));
    if (typeof value === "number" && Number.isFinite(value)) {
      const y = scale.toY(value);
      if (started) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      started = true;
    }
    if (x >= to) break;
  }
  ctx.stroke();
}

/**
 * Paints the graph: a grid at each second, the center line, every curve in its color (the primary
 * stronger, with its high and low at the left), then the keys as diamonds, red when selected.
 * Only the visible window is sampled.
 */
export function drawCurves(ctx: CanvasRenderingContext2D, scene: CurveScene): void {
  const { width, height, scrollLeft, pxPerSecond, curves, selection } = scene;
  const style = getComputedStyle(ctx.canvas);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const colors = CURVE_COLORS.map(token);
  const grid = token("--border");
  const axis = token("--border-strong");
  const surface = token("--surface");
  const mark = token("--mark");
  const text = token("--muted-foreground");

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1;
  const step = GRID_STEPS.find((s) => s * pxPerSecond >= GRID_MIN_PX) ?? 3600;
  ctx.strokeStyle = grid;
  ctx.beginPath();
  const first = Math.ceil(scrollLeft / pxPerSecond / step) * step;
  for (let s = first; s * pxPerSecond - scrollLeft <= width; s += step) {
    const x = Math.round(s * pxPerSecond - scrollLeft) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  ctx.stroke();
  const middle = Math.round(height / 2) + 0.5;
  ctx.strokeStyle = axis;
  ctx.beginPath();
  ctx.moveTo(0, middle);
  ctx.lineTo(width, middle);
  ctx.stroke();

  // The primary goes last, so it lies on top.
  const ordered = [...curves].sort((a, b) => Number(a.primary) - Number(b.primary));
  for (const curve of ordered) {
    const color = colors[curve.slot % colors.length] ?? text;
    ctx.strokeStyle = color;
    ctx.lineWidth = curve.primary ? 2 : 1.25;
    ctx.globalAlpha = curve.primary ? 1 : 0.6;
    trace(ctx, curve, scene);
    ctx.globalAlpha = 1;
    if (curve.primary) {
      ctx.fillStyle = text;
      ctx.font = "10px monospace";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(label(curve.scale.high), 6, CURVE_PADDING - 8);
      ctx.fillText(label(curve.scale.low), 6, height - CURVE_PADDING + 14);
    }
  }

  const r = CURVE_KEY_RADIUS;
  for (const curve of ordered) {
    const color = colors[curve.slot % colors.length] ?? text;
    for (const key of curve.track.keys) {
      const p = keyPoint(curve, key, pxPerSecond, scrollLeft);
      if (!p || p.x < -r || p.x > width + r) continue;
      const picked = selection.has(`${curve.clip.id}|${curve.path}|${key.id}`);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r - 1);
      ctx.lineTo(p.x + r + 1, p.y);
      ctx.lineTo(p.x, p.y + r + 1);
      ctx.lineTo(p.x - r - 1, p.y);
      ctx.closePath();
      ctx.fillStyle = picked ? mark : surface;
      ctx.fill();
      ctx.strokeStyle = picked ? mark : color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}
