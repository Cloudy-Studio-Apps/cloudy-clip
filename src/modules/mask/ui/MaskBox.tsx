import { MoveVertical } from "lucide-react";
import {
  MARKER_HEX,
  maskOutline,
  type ClipMask,
  type MaskMapping,
  type ProjectFormat,
} from "@/modules/project";
import { cn } from "@/ui";
import { MOVE_HANDLE, presetHandles, withPatch } from "../logic/handles";
import { toFrame, turn, vecToFrame } from "../logic/mapping";
import type { MaskHandle, MaskHandleKind } from "../mask.types";
import { startMaskDrag } from "./mask.box.gesture";
import type { useMaskEdit } from "./mask.edit.hook";
import { boxData, outlineData, overlayOf, paintMask, spot } from "./mask.paint";

interface MaskBoxProps {
  /** The selected preset mask at the playhead. */
  mask: ClipMask;
  mapping: MaskMapping;
  format: ProjectFormat;
  edit: ReturnType<typeof useMaskEdit>;
}

const TITLES: Record<MaskHandleKind, string> = {
  move: "Drag to move the mask",
  corner: "Drag to resize (Shift keeps proportions, Alt from the center)",
  side: "Drag to stretch (Alt from the center)",
  rotate: "Drag to rotate (Shift: 15° steps)",
  feather: "Drag to feather the edge",
  roundness: "Drag to round the corners",
  inner: "Drag to move the inner points",
  width: "Drag to change the width",
};

const LOOKS: Record<MaskHandleKind, string> = {
  move: "size-2 bg-primary",
  corner: "size-2 border border-primary bg-background",
  side: "size-2 border border-primary bg-background",
  width: "size-2 border border-primary bg-background",
  rotate: "size-2.5 border border-primary bg-background",
  roundness: "size-2 rotate-45 bg-primary",
  inner: "size-2 rotate-45 bg-primary",
  feather: "size-4 items-center justify-center rounded-xs bg-background text-primary",
};

/**
 * The selected preset mask on the canvas: its outline (drag inside to move), its box with corners
 * and sides, and its rotate, feather, roundness, inner and width handles. A drag redraws the
 * overlay in the DOM and the picture through `previewProps`; release sends one `mask.update` at
 * the playhead; Escape cancels.
 */
export function MaskBox({ mask, mapping, format, edit }: MaskBoxProps) {
  const grab = (e: React.PointerEvent<Element>, handle: MaskHandle) => {
    const frame = overlayOf(e.currentTarget);
    if (e.button !== 0 || !frame) return;
    e.preventDefault();
    e.stopPropagation();
    const restore = () => paintMask(frame, mask, mapping, format);
    startMaskDrag({
      event: e.nativeEvent,
      frame,
      format,
      mapping,
      mask,
      handle,
      onMove(patch) {
        paintMask(frame, withPatch(mask, patch), mapping, format);
        edit.live(mask.id, patch as Record<string, unknown>);
      },
      onDrop(patch) {
        void edit.update(mask.id, patch as Record<string, unknown>).then((ok) => {
          if (!ok) restore();
        });
      },
      onCancel() {
        restore();
        edit.clear();
      },
    });
  };

  const color = MARKER_HEX[mask.color];
  const filled = maskOutline(mask) !== null;
  // The feather arrow points along the mask's own y axis, however the picture is turned.
  const down = vecToFrame(mapping, turn({ x: 0, y: 1 }, mask.rotation));
  const arrow = (Math.atan2(down.y, down.x) * 180) / Math.PI - 90;
  const { width, height } = format;
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <path
          data-mask-box
          d={boxData(mask, mapping)}
          fill="none"
          stroke={color}
          strokeOpacity={0.6}
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <path
          data-mask-line
          d={outlineData(mask, mapping, format)}
          fill={filled ? "transparent" : "none"}
          stroke={color}
          strokeWidth={2}
          strokeDasharray={mask.on === false ? "4 3" : undefined}
          vectorEffect="non-scaling-stroke"
          className="cursor-move"
          style={{ pointerEvents: filled ? "visiblePainted" : "none" }}
          onPointerDown={(e) => grab(e, MOVE_HANDLE)}
        >
          <title>{TITLES.move}</title>
        </path>
      </svg>
      {presetHandles(mask, mapping).map((handle) => {
        const at = toFrame(mapping, handle.at);
        const feather = handle.kind === "feather";
        return (
          <i
            key={handle.id}
            data-mask-handle={handle.id}
            title={TITLES[handle.kind]}
            className={cn(
              "pointer-events-auto absolute block -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_1px_var(--background)]",
              handle.kind === "rotate" ? "cursor-grab" : "cursor-move",
              feather && "flex",
              LOOKS[handle.kind],
            )}
            style={spot(at, format)}
            onPointerDown={(e) => grab(e, handle)}
          >
            {feather && <MoveVertical className="size-3" style={{ rotate: `${arrow}deg` }} />}
          </i>
        );
      })}
    </>
  );
}
