import type { GpuPass, MixEnv } from "@/modules/junction";
import { drawGpu } from "../logic/gpu";
import { ghostCanvas } from "./presets.cache";

/**
 * Draws `scene` over `ctx` blurred by `pass` (which reads source `-1`, the scene): the scene goes
 * into a cleared scratch canvas, which the GPU blurs onto `ctx`. `blur` false draws the scene
 * straight onto `ctx`; `blur` true with no GPU, or no scratch canvas, calls `env.withoutGpu()` and
 * draws it there unblurred. `ctx` is never cleared: it holds the tracks below. A GPU failure is not
 * caught: an export must fail loudly.
 */
export function drawBlurred(
  ctx: CanvasRenderingContext2D,
  env: MixEnv,
  blur: boolean,
  pass: GpuPass,
  scene: (target: CanvasRenderingContext2D) => void,
): void {
  const { width, height } = ctx.canvas;
  const ghost = blur && env.gpu ? ghostCanvas(ctx.canvas, width, height) : null;
  if (blur && !ghost) env.withoutGpu();
  const target = ghost ? ghost.ctx : ctx;
  target.save();
  target.globalAlpha = 1;
  target.globalCompositeOperation = "source-over";
  if (ghost) ghost.ctx.clearRect(0, 0, width, height);
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
