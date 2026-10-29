import { forwardRef } from "react";
import type { ClipPlacement, ProjectFormat } from "@/modules/project";
import { boxStyle } from "./box.style";

const CORNERS = ["-left-1 -top-1", "-right-1 -top-1", "-bottom-1 -left-1", "-bottom-1 -right-1"];

interface SelectionBoxProps {
  placement: ClipPlacement;
  format: ProjectFormat;
  /** Which handles to show: corners when it can be scaled, the top handle when it can turn. */
  handles: { scale: boolean; rotate: boolean };
}

/**
 * The outline of the selected picture: drag inside to move, a corner to scale, the handle on top
 * to rotate (Shift snaps to 15°). Handles are found by their `data-handle` attribute; a handle
 * whose field the element doesn't support isn't shown.
 */
export const SelectionBox = forwardRef<HTMLDivElement, SelectionBoxProps>(function SelectionBox(
  { placement, format, handles },
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
            className={`absolute size-2 cursor-nwse-resize border border-primary bg-white ${corner}`}
          />
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
    </div>
  );
});
