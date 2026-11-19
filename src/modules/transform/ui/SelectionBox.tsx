import { forwardRef } from "react";
import type { ClipPlacement, ClipTransform, ProjectFormat } from "@/modules/project";
import { boxStyle, pivotStyle } from "./box.style";

const HANDLE = "absolute size-2 border border-primary bg-white";
const CORNERS = ["-left-1 -top-1", "-right-1 -top-1", "-bottom-1 -left-1", "-bottom-1 -right-1"];
const SIDES_X = ["-left-1 top-1/2 -translate-y-1/2", "-right-1 top-1/2 -translate-y-1/2"];
const SIDES_Y = ["-top-1 left-1/2 -translate-x-1/2", "-bottom-1 left-1/2 -translate-x-1/2"];

interface SelectionBoxProps {
  placement: ClipPlacement;
  transform: ClipTransform;
  format: ProjectFormat;
  /** Which handles to show: each only when the element supports the fields it changes. */
  handles: {
    scale: boolean;
    rotate: boolean;
    stretchX: boolean;
    stretchY: boolean;
    pivot: boolean;
  };
}

/**
 * The outline of the selected picture: drag inside to move, a corner to scale, a side to stretch
 * (past the pivot flips), the handle on top to rotate (Shift snaps to 15°), the crosshair to move
 * the pivot. Handles are found by their `data-handle` attribute; a handle whose field the element
 * doesn't support isn't shown.
 */
export const SelectionBox = forwardRef<HTMLDivElement, SelectionBoxProps>(function SelectionBox(
  { placement, transform, format, handles },
  ref,
) {
  return (
    <div
      ref={ref}
      data-handle="move"
      className="absolute cursor-move outline outline-1 outline-primary"
      style={boxStyle(placement, format)}
    >
      {handles.scale &&
        CORNERS.map((corner) => (
          <i
            key={corner}
            data-handle="scale"
            className={`${HANDLE} cursor-nwse-resize ${corner}`}
          />
        ))}
      {handles.stretchX &&
        SIDES_X.map((side) => (
          <i key={side} data-handle="stretchX" className={`${HANDLE} cursor-ew-resize ${side}`} />
        ))}
      {handles.stretchY &&
        SIDES_Y.map((side) => (
          <i key={side} data-handle="stretchY" className={`${HANDLE} cursor-ns-resize ${side}`} />
        ))}
      {handles.rotate && (
        <>
          <span className="pointer-events-none absolute -top-5 left-1/2 h-4 w-px bg-primary" />
          <i
            data-handle="rotate"
            title="Rotate (Shift snaps to 15°)"
            className="absolute -top-7 left-1/2 size-2.5 -translate-x-1/2 cursor-grab border border-primary bg-white"
          />
        </>
      )}
      {handles.pivot && (
        <i
          data-handle="pivot"
          title="Pivot"
          className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-xs border border-primary"
          style={pivotStyle(transform)}
        >
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-primary" />
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-primary" />
        </i>
      )}
    </div>
  );
});
