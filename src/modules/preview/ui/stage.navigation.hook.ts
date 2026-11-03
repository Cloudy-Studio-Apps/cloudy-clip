import { useEffect, type RefObject } from "react";
import { useModule } from "@/core";
import { previewRef } from "../preview.ref";

/** Wheel zoom speed: the zoom changes by e^(-deltaY × this). */
const WHEEL_ZOOM_SPEED = 0.002;

/**
 * Viewer navigation on the stage: Ctrl/Cmd + wheel zooms at the pointer, wheel and middle-drag pan.
 * Nothing while `enabled` is false.
 */
export function useStageNavigation(
  stageRef: RefObject<HTMLDivElement | null>,
  enabled = true,
): void {
  const { viewport } = useModule(previewRef);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !enabled) return;

    const fromCenter = (clientX: number, clientY: number) => {
      const rect = stage.getBoundingClientRect();
      return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        viewport.zoomBy(Math.exp(-e.deltaY * WHEEL_ZOOM_SPEED), fromCenter(e.clientX, e.clientY));
      } else {
        viewport.panBy(-e.deltaX, -e.deltaY);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      stage.setPointerCapture(e.pointerId);
      stage.style.cursor = "grabbing";
      let last = { x: e.clientX, y: e.clientY };
      const move = (ev: PointerEvent) => {
        viewport.panBy(ev.clientX - last.x, ev.clientY - last.y);
        last = { x: ev.clientX, y: ev.clientY };
      };
      const up = () => {
        stage.style.cursor = "";
        stage.removeEventListener("pointermove", move);
        stage.removeEventListener("pointerup", up);
        stage.removeEventListener("pointercancel", up);
      };
      stage.addEventListener("pointermove", move);
      stage.addEventListener("pointerup", up);
      stage.addEventListener("pointercancel", up);
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onPointerDown);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onPointerDown);
    };
  }, [stageRef, viewport, enabled]);
}
