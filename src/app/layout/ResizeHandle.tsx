import type { RefObject } from "react";
import { cn } from "@/ui";
import type { ResizableArea } from "./layout.types";
import { clampSize, RESIZE_RULES, readPanelSizes, savePanelSizes } from "./layout.sizes";

interface ResizeHandleProps {
  area: ResizableArea;
  /** The layout grid, which holds the size variables. */
  gridRef: RefObject<HTMLElement | null>;
  /** Which edge of its area the handle sits on. */
  edge: "left" | "right" | "top";
}

const EDGE_STYLE = {
  left: "inset-y-0 -left-[5px] w-2 cursor-col-resize after:inset-y-0 after:left-[3px] after:w-0.5",
  right:
    "inset-y-0 -right-[5px] w-2 cursor-col-resize after:inset-y-0 after:left-[3px] after:w-0.5",
  top: "inset-x-0 -top-[5px] h-2 cursor-row-resize after:inset-x-0 after:top-[3px] after:h-0.5",
} as const;

/**
 * A wide invisible hit area on a panel edge, with a thin line that lights up on hover and drag.
 * Drag to resize (the size is written straight to a CSS variable, no React renders), double-click
 * to reset. Sizes are remembered between sessions.
 */
export function ResizeHandle({ area, gridRef, edge }: ResizeHandleProps) {
  const rule = RESIZE_RULES[area];

  return (
    <div
      role="separator"
      aria-orientation={rule.axis === "x" ? "vertical" : "horizontal"}
      title="Drag to resize · double-click to reset"
      className={cn(
        "absolute z-50 touch-none after:absolute after:bg-primary after:opacity-0 after:transition-opacity after:duration-150 hover:after:opacity-100 data-[dragging=true]:after:opacity-100",
        EDGE_STYLE[edge],
      )}
      onPointerDown={(event) => {
        const grid = gridRef.current;
        const panel = event.currentTarget.parentElement;
        if (event.button !== 0 || !grid || !panel) return;
        event.preventDefault();
        const handle = event.currentTarget;
        handle.setPointerCapture(event.pointerId);
        handle.dataset.dragging = "true";
        document.body.dataset.resizing = rule.axis;

        const start = rule.axis === "x" ? event.clientX : event.clientY;
        const startSize = rule.axis === "x" ? panel.offsetWidth : panel.offsetHeight;
        let size = startSize;

        const onMove = (e: PointerEvent) => {
          const delta = (rule.axis === "x" ? e.clientX : e.clientY) - start;
          size = clampSize(rule, startSize + delta * rule.sign);
          grid.style.setProperty(rule.cssVar, `${size}px`);
        };
        const onUp = () => {
          delete handle.dataset.dragging;
          delete document.body.dataset.resizing;
          handle.removeEventListener("pointermove", onMove);
          handle.removeEventListener("pointerup", onUp);
          handle.removeEventListener("pointercancel", onUp);
          savePanelSizes({ ...readPanelSizes(), [area]: size });
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", onUp);
      }}
      onDoubleClick={() => {
        gridRef.current?.style.removeProperty(rule.cssVar);
        const sizes = readPanelSizes();
        delete sizes[area];
        savePanelSizes(sizes);
      }}
    />
  );
}
