import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { seededRandom } from "../logic/noise";
import {
  THUMB_HEIGHT,
  THUMB_HOLD,
  THUMB_LOOP_SECONDS,
  THUMB_STATIC_PROGRESS,
  THUMB_WIDTH,
} from "../transition.layout";
import type { TransitionPresetDefinition } from "../transition.types";
import { drawSample, sampleColors } from "./thumbnail.draw";

function sampleCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;
  return canvas;
}

/**
 * Draws a preset's thumbnail into `canvasRef`: one static frame, and a looping animation while
 * `start()` is active (until `stop()`). Frames are painted by `requestAnimationFrame` straight onto
 * the canvas, with no React state. The mix always gets the hook's own picture canvases, redrawn
 * every frame, because mask presets draw into `b`.
 */
export function usePresetThumbnail(
  preset: TransitionPresetDefinition,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): { start(): void; stop(): void } {
  const project = useModule(projectRef).store;
  const frame = useRef(0);
  const draw = useMemo(() => {
    const a = sampleCanvas();
    const b = sampleCanvas();
    const aCtx = a.getContext("2d");
    const bCtx = b.getContext("2d");
    return (progress: number, elapsed: number): void => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !aCtx || !bCtx) return;
      const format = project.getState().format;
      const colors = sampleColors();
      drawSample(aCtx, colors.a, "circle");
      drawSample(bCtx, colors.b, "square");
      ctx.clearRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
      const mix = preset.thumbnail ?? preset.mix;
      mix(ctx, a, b, progress, preset.defaults(format), {
        format,
        kx: THUMB_WIDTH / format.width,
        ky: THUMB_HEIGHT / format.height,
        random: seededRandom(preset.id),
        elapsed,
      });
    };
  }, [canvasRef, preset, project]);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    draw(THUMB_STATIC_PROGRESS, 0);
  }, [draw]);

  const start = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const t0 = performance.now();
    const tick = (now: number): void => {
      const elapsed = (now - t0) / 1000;
      const t = (elapsed % THUMB_LOOP_SECONDS) / THUMB_LOOP_SECONDS;
      const progress = Math.min(1, Math.max(0, (t - THUMB_HOLD) / (1 - 2 * THUMB_HOLD)));
      draw(progress, elapsed);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [draw]);

  useEffect(() => {
    draw(THUMB_STATIC_PROGRESS, 0);
    return () => cancelAnimationFrame(frame.current);
  }, [draw]);

  return { start, stop };
}
