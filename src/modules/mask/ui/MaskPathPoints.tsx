import { useEffect } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { framePoint, paintPath, startPathEdit, type PointPart } from "@/modules/path";
import {
  MARKER_HEX,
  insertPoint,
  nearestOnPath,
  pathData,
  type ClipMask,
  type MaskMapping,
  type MaskShape,
  type PathPoint,
  type ProjectFormat,
} from "@/modules/project";
import { cn } from "@/ui";
import { MOVE_HANDLE, withPatch } from "../logic/handles";
import { pointsToFrame, pointsToMask } from "../logic/mapping";
import { maskRef } from "../mask.ref";
import { startMaskDrag } from "./mask.box.gesture";
import type { useMaskEdit } from "./mask.edit.hook";
import { isTextField, overlayOf, spot } from "./mask.paint";

/** How near the line a double-click adds a point, in output px. */
const ADD_REACH = 24;

interface MaskPathPointsProps {
  clipId: string;
  /** The selected path mask at the playhead. */
  mask: ClipMask;
  mapping: MaskMapping;
  format: ProjectFormat;
  edit: ReturnType<typeof useMaskEdit>;
}

/**
 * The selected path mask on the canvas, edited as the motion path is (`startPathEdit` on its
 * points mapped into the frame): drag a point or a handle (Alt breaks the pair), double-click the
 * line to add a point, Delete removes the selected point while four or more stay, a drag inside
 * moves the mask's x/y. Each release sends one command at the playhead.
 */
export function MaskPathPoints({ clipId, mask, mapping, format, edit }: MaskPathPointsProps) {
  const { ui } = useModule(maskRef);
  const shape = mask.shape as Extract<MaskShape, { kind: "path" }>;
  const order = shape.pointOrder.filter((id) => shape.points[id]);
  const local = order.map((id) => shape.points[id]!);
  const points = pointsToFrame(mapping, mask, shape.scale, local);
  const chosen = useStore(ui, (s) => s.selectedPointId);
  const selected = chosen === null ? -1 : order.indexOf(chosen);

  const setPoints = (next: PathPoint[], ids: (string | undefined)[], extra = {}) =>
    edit.run("mask.setPoints", {
      clipId,
      maskId: mask.id,
      points: next.map((p, i) => (ids[i] === undefined ? p : { ...p, id: ids[i] })),
      at: edit.now(),
      ...extra,
    });

  useEffect(() => {
    if (selected < 0 || order.length < 4) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "Delete" && e.key !== "Backspace") || isTextField(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      ui.setState({ selectedPointId: null });
      const keep = (_: unknown, i: number) => i !== selected;
      void setPoints(local.filter(keep), order.filter(keep));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const grab = (e: React.PointerEvent<HTMLElement>, index: number, part: PointPart) => {
    const frame = overlayOf(e.currentTarget);
    if (e.button !== 0 || !frame) return;
    e.preventDefault();
    e.stopPropagation();
    if (part === "point") ui.setState({ selectedPointId: order[index]! });
    startPathEdit({
      event: e.nativeEvent,
      frame,
      size: format,
      points,
      closed: true,
      index,
      part,
      onDrop: (moved) => {
        const back = pointsToMask(mapping, mask, shape.scale, moved);
        void setPoints(back, order).then((ok) => {
          if (!ok) paintPath(frame, points, true, format);
        });
      },
    });
  };

  const move = (e: React.PointerEvent<SVGPathElement>) => {
    const frame = overlayOf(e.currentTarget);
    if (e.button !== 0 || !frame) return;
    e.preventDefault();
    e.stopPropagation();
    ui.setState({ selectedPointId: null });
    const restore = () => paintPath(frame, points, true, format);
    startMaskDrag({
      event: e.nativeEvent,
      frame,
      format,
      mapping,
      mask,
      handle: MOVE_HANDLE,
      onMove(patch) {
        const moved = withPatch(mask, patch);
        paintPath(frame, pointsToFrame(mapping, moved, shape.scale, local), true, format);
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

  const addPoint = (e: React.MouseEvent<SVGPathElement>) => {
    const frame = overlayOf(e.currentTarget);
    if (!frame) return;
    e.stopPropagation();
    const near = nearestOnPath(points, true, framePoint(frame, format, e.clientX, e.clientY));
    if (near.distance > ADD_REACH) return;
    // Bézier splits are the same in any affine space: split the mask's own points.
    const ids: (string | undefined)[] = [...order];
    ids.splice(near.segment + 1, 0, undefined);
    const insertAt = { after: order[near.segment]!, t: near.t };
    void setPoints(insertPoint(local, near.segment, near.t), ids, { insertAt }).then((done) => {
      const { pointIds } = (done?.value ?? {}) as { pointIds?: string[] };
      const added = pointIds?.[near.segment + 1];
      if (added) ui.setState({ selectedPointId: added });
    });
  };

  const d = pathData(points, true);
  const shown = selected < 0 ? null : points[selected]!;
  const { width, height } = format;
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <path
          data-path-line
          d={d}
          fill="transparent"
          stroke="transparent"
          strokeWidth={14}
          vectorEffect="non-scaling-stroke"
          className="cursor-move"
          style={{ pointerEvents: "all" }}
          onPointerDown={move}
          onDoubleClick={addPoint}
        >
          <title>Drag to move the mask; double-click the line to add a point</title>
        </path>
        <path
          data-path-line
          d={d}
          fill="none"
          stroke={MARKER_HEX[mask.color]}
          strokeWidth={2}
          strokeDasharray={mask.on === false ? "4 3" : undefined}
          vectorEffect="non-scaling-stroke"
        />
        {shown &&
          (["in", "out"] as const).map((side) => (
            <line
              key={side}
              data-stem={`${selected}:${side}`}
              x1={shown.x}
              y1={shown.y}
              x2={shown.x + shown[`${side}X`]}
              y2={shown.y + shown[`${side}Y`]}
              className="stroke-primary"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>
      {points.map((p, i) => (
        <i
          key={order[i]}
          data-point={i}
          title="Drag to move this point"
          className={cn(
            "pointer-events-auto absolute -ml-1 -mt-1 block size-2 cursor-move border border-primary shadow-[0_0_0_1px_var(--background)]",
            i === selected ? "bg-primary" : "bg-background",
          )}
          style={spot(p, format)}
          onPointerDown={(e) => grab(e, i, "point")}
        />
      ))}
      {shown &&
        (["in", "out"] as const).map((side) => (
          <i
            key={side}
            data-handle={`${selected}:${side}`}
            title="Drag to bend the curve (Alt moves this handle alone)"
            className="pointer-events-auto absolute -ml-1 -mt-1 block size-2 cursor-move rounded-full bg-primary shadow-[0_0_0_1px_var(--background)]"
            style={spot({ x: shown.x + shown[`${side}X`], y: shown.y + shown[`${side}Y`] }, format)}
            onPointerDown={(e) => grab(e, selected, side)}
          />
        ))}
    </>
  );
}
