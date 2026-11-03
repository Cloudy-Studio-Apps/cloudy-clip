import { useEffect, type RefObject } from "react";
import { useModule } from "@/core";
import { useOpenFormat } from "@/modules/project";
import { previewRef } from "../preview.ref";

/** Space kept around the frame when it fits the stage, in px. */
const STAGE_PADDING = 20;

/** The frame fitted to the stage, centred. */
const FITTED = { zoom: 1, panX: 0, panY: 0 };

/**
 * Sizes and places the frame from the stage size, the project format and the viewer's zoom and
 * pan. The canvas backing store matches the displayed size × device pixel ratio, capped at the
 * project resolution, so it is sharp without wasting fill rate. Without `followViewport` the frame
 * just fits the stage.
 */
export function useStageLayout(
  stageRef: RefObject<HTMLDivElement | null>,
  frameRef: RefObject<HTMLDivElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  followViewport = true,
): void {
  const preview = useModule(previewRef);
  const format = useOpenFormat();

  useEffect(() => {
    const stage = stageRef.current;
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!stage || !frame || !canvas) return;

    const layout = () => {
      const width = stage.clientWidth - STAGE_PADDING * 2;
      const height = stage.clientHeight - STAGE_PADDING * 2;
      if (width <= 0 || height <= 0) return;
      const { zoom, panX, panY } = followViewport ? preview.viewport.store.getState() : FITTED;
      const fit = Math.min(width / format.width, height / format.height);
      const cssWidth = Math.max(1, format.width * fit * zoom);
      const cssHeight = Math.max(1, format.height * fit * zoom);
      frame.style.width = `${cssWidth}px`;
      frame.style.height = `${cssHeight}px`;
      frame.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))`;

      const backingWidth = Math.round(
        Math.min(cssWidth * (window.devicePixelRatio || 1), format.width),
      );
      const backingHeight = Math.round((backingWidth * format.height) / format.width);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
        preview.redraw();
      }
    };
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(stage);
    const offViewport = followViewport ? preview.viewport.store.subscribe(layout) : undefined;
    return () => {
      observer.disconnect();
      offViewport?.();
    };
  }, [format, preview, stageRef, frameRef, canvasRef, followViewport]);
}
