import { useEffect } from "react";
import { useStore } from "zustand";
import { notify, useKernel, useModule } from "@/core";
import {
  projectRef,
  useOpenComposition,
  useOpenFormat,
  type MotionPath,
  type PathPoint,
  type PointPart,
  insertPoint,
  nearestOnPath,
  pathData,
  removePoint,
} from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { cn } from "@/ui";
import { updatePath } from "../path.commands";
import { pathRef } from "../path.ref";
import { startPathEdit } from "./path.edit.gesture";
import { framePoint, spot } from "./path.paint";

/** How near the line a double-click adds a point, in output px. */
const ADD_REACH = 24;

const isTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** The overlay's root, which covers the frame exactly. */
const overlayOf = (from: Element) => from.closest<HTMLElement>("[data-path-overlay]");

/** The path shown: the one picked in the Library, else the one the single selected clip follows. */
function useShownPath(): MotionPath | null {
  const { ui } = useModule(pathRef);
  const store = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const picked = useStore(ui, (s) => s.selectedPathId);
  const drawing = useStore(ui, (s) => s.drawing);
  const selection = useStore(timeline.view, (s) => s.selection);
  const open = useOpenComposition()?.id;
  return useStore(store.api, (s) => {
    if (drawing) return null;
    const mine = (id: string | undefined) => {
      const path = id ? s.paths?.[id] : undefined;
      return path?.compositionId === open ? path : undefined;
    };
    const only = selection.length === 1 ? s.clips[selection[0]!] : undefined;
    return mine(picked ?? undefined) ?? mine(only?.follow?.pathId) ?? null;
  });
}

/**
 * The shown motion path over the frame (DOM only, never in a capture or export): its line, its
 * points, and the selected point's handles. Drag a point or a handle (Alt breaks the pair),
 * double-click the line to add a point, Delete removes the selected point.
 */
export function PathOverlay() {
  const { bus } = useKernel();
  const { ui } = useModule(pathRef);
  const format = useOpenFormat();
  const path = useShownPath();
  const chosen = useStore(ui, (s) => s.selectedPoint);
  const selected = path && chosen !== null && chosen < path.points.length ? chosen : null;

  const save = (points: PathPoint[]) => {
    if (!path) return;
    void bus.run(updatePath, { pathId: path.id, points }).then((result) => {
      if (!result.ok) notify("error", result.error.message);
    });
  };

  const pathId = path?.id;
  // A point stays selected only while its path is shown and nothing else is pressed.
  useEffect(() => {
    ui.setState({ selectedPoint: null });
    if (!pathId) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-point], [data-handle]")) {
        ui.setState({ selectedPoint: null });
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [pathId, ui]);

  useEffect(() => {
    // With two points none can go: Delete is left to the timeline.
    if (!path || selected === null || path.points.length <= 2) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "Delete" && e.key !== "Backspace") || isTextField(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      ui.setState({ selectedPoint: null });
      save(removePoint(path.points, selected));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!path || !format) return null;
  const { width, height } = format;

  const grab = (e: React.PointerEvent<HTMLElement>, index: number, part: PointPart) => {
    const frame = overlayOf(e.currentTarget);
    if (e.button !== 0 || !frame) return;
    e.preventDefault();
    e.stopPropagation();
    if (part === "point") ui.setState({ selectedPoint: index });
    startPathEdit({
      event: e.nativeEvent,
      frame,
      size: format,
      points: path.points,
      closed: path.closed,
      index,
      part,
      onDrop: save,
    });
  };

  const addPoint = (e: React.MouseEvent<SVGPathElement>) => {
    const frame = overlayOf(e.currentTarget);
    if (!frame) return;
    e.stopPropagation();
    const at = framePoint(frame, format, e.clientX, e.clientY);
    const near = nearestOnPath(path.points, path.closed, at);
    if (near.distance > ADD_REACH) return;
    ui.setState({ selectedPoint: near.segment + 1 });
    save(insertPoint(path.points, near.segment, near.t));
  };

  const d = pathData(path.points, path.closed);
  const shown = selected === null ? null : path.points[selected]!;
  return (
    <div data-path-overlay className="pointer-events-none absolute inset-0">
      <svg
        className="absolute inset-0 size-full overflow-visible"
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <path
          data-path-line
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          vectorEffect="non-scaling-stroke"
          className="cursor-copy"
          style={{ pointerEvents: "stroke" }}
          onDoubleClick={addPoint}
        >
          <title>Double-click to add a point</title>
        </path>
        <path
          data-path-line
          d={d}
          fill="none"
          className="stroke-primary"
          strokeWidth={1.5}
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
      {path.points.map((p, i) => (
        <i
          key={i}
          data-point={i}
          title="Drag to move this point"
          className={cn(
            "pointer-events-auto absolute -ml-1 -mt-1 block size-2 cursor-move border border-primary shadow-[0_0_0_1px_var(--background)]",
            i === selected ? "bg-primary" : "bg-background",
          )}
          style={spot(p.x, p.y, format)}
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
            style={spot(shown.x + shown[`${side}X`], shown.y + shown[`${side}Y`], format)}
            onPointerDown={(e) => grab(e, selected!, side)}
          />
        ))}
    </div>
  );
}
