import { useRef, type PointerEvent } from "react";
import type { ColorChangeInfo, DragPosition, PointerDragHandlers } from "./kit.types";

/**
 * Reports the pointer's position inside an element while it is pressed and dragged (captured, so
 * it keeps following outside), with `done: true` on release.
 */
export function usePointerDrag(
  onDrag: (position: DragPosition, info: ColorChangeInfo) => void,
): PointerDragHandlers {
  const dragging = useRef(false);
  const report = (event: PointerEvent<HTMLElement>, done: boolean) => {
    const box = event.currentTarget.getBoundingClientRect();
    const unit = (value: number) => Math.min(1, Math.max(0, value));
    onDrag(
      {
        x: unit((event.clientX - box.left) / Math.max(1, box.width)),
        y: unit((event.clientY - box.top) / Math.max(1, box.height)),
      },
      { done },
    );
  };
  const end = (event: PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    report(event, true);
  };
  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus();
      dragging.current = true;
      report(event, false);
    },
    onPointerMove: (event) => {
      if (dragging.current) report(event, false);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}
