import type { GpuPass, MixEnv } from "@/modules/junction";
import { drawGpu } from "../logic/gpu";
import { ghostCanvas } from "./presets.cache";

/**
 * Draws `scene` on `ctx`, then blurs it by `pass` (which reads source `-1`, the scene) on the GPU.
 * `blur` false draws the scene alone; true without a GPU calls `env.withoutGpu()` and draws it
 * unblurred. A GPU failure is not caught: an export must fail loudly.
 */
export function drawBlurred(
  ctx: CanvasRenderingContext2D,
  env: MixEnv,
  blur: boolean,
  pass: GpuPass,
  scene: (target: CanvasRenderingContext2D) => void,
): void {
  if (blur && !env.gpu) env.withoutGpu();
  const { width, height } = ctx.canvas;
  const ghost = blur && env.gpu ? ghostCanvas(ctx.canvas, width, height) : null;
  const target = ghost ? ghost.ctx : ctx;
  target.save();
  target.globalAlpha = 1;
  target.globalCompositeOperation = "source-over";
  target.clearRect(0, 0, width, height);
  scene(target);
  target.restore();
  if (ghost && env.gpu) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    drawGpu(ctx, env.gpu, [ghost.canvas], [pass]);
    ctx.restore();
  }
}

/** Draws `source` full-frame, scaled by `scale` and turned by `angle` radians about the center, then moved by (`dx`, `dy`). */
export function drawMoved(
  target: CanvasRenderingContext2D,
  source: CanvasImageSource,
  scale: number,
  angle: number,
  dx = 0,
  dy = 0,
): void {
  const { width, height } = target.canvas;
  target.save();
  target.translate(width / 2 + dx, height / 2 + dy);
  target.rotate(angle);
  target.scale(scale, scale);
  target.drawImage(source, -width / 2, -height / 2, width, height);
  target.restore();
}

/**
 * A thumbnail for a blurred preset: `draw(i)` is called for 4 copies (i = 0 the sharp one, each
 * further one reaching further) stacked at decreasing alpha, which suggests the blur without a GPU.
 */
export function drawStacked(ctx: CanvasRenderingContext2D, draw: (copy: number) => void): void {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = 1 / (i + 1);
    draw(i);
  }
  ctx.restore();
}
