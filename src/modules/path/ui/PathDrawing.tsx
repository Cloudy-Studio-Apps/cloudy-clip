import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { notify, useKernel, useModule } from "@/core";
import { fitStroke, useOpenFormat, type PathPoint } from "@/modules/project";
import { Button, SegmentedControl } from "@/ui";
import { createPath } from "../path.commands";
import { pathRef } from "../path.ref";
import type { DrawMode } from "../path.types";
import { startFreehand, startPenPoint } from "./draw.gesture";

/** How far a freehand fit may stray from the stroke, and how near the first point a click closes, in screen px. */
const FIT_SCREEN_PX = 4;
const CLOSE_SCREEN_PX = 8;

const MODES = [
  { value: "freehand", label: "Freehand" },
  { value: "pen", label: "Pen" },
] as const;

/** The pen's points without the ones a double-click stacks on the same spot. */
const distinct = (points: readonly PathPoint[]) =>
  points.filter(
    (p, i) => i === 0 || Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y) >= 1,
  );

/**
 * Drawing a new path over the frame (`ui.drawing`). Freehand: one stroke, fitted into a few smooth
 * points on release. Pen: a click adds a corner, a click-drag pulls its handles, a click on the
 * first point closes the path; Enter, a double-click or Done finishes; Escape or Cancel stops.
 * Finishing sends one `path.create` (with the clips to attach), and the new path is selected.
 */
export function PathDrawing() {
  const { bus } = useKernel();
  const { ui } = useModule(pathRef);
  const drawing = useStore(ui, (s) => s.drawing);
  const format = useOpenFormat();
  const line = useRef<SVGPathElement>(null);
  const pen = useRef<PathPoint[]>([]);
  const [count, setCount] = useState(0);

  const stop = () => {
    pen.current = [];
    setCount(0);
    line.current?.setAttribute("d", "");
    ui.setState({ drawing: null });
  };

  const create = (points: PathPoint[], closed: boolean) => {
    const attach = ui.getState().drawing?.attach ?? [];
    stop();
    if (points.length < 2) return;
    void bus.run(createPath, { points, closed, attach }).then((result) => {
      if (!result.ok) return notify("error", result.error.message);
      const { pathId } = result.value as { pathId: string };
      ui.setState({ selectedPathId: pathId, selectedPoint: null });
    });
  };
  const finishPen = (closed = false) => create(distinct(pen.current), closed);

  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "Enter" && drawing.mode === "pen") finishPen();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!drawing) return null;

  const setMode = (mode: DrawMode) => {
    pen.current = [];
    setCount(0);
    line.current?.setAttribute("d", "");
    ui.setState({ drawing: { ...drawing, mode } });
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const frame = e.currentTarget;
    if (e.button !== 0 || !line.current) return;
    e.preventDefault();
    const scale = format.width / frame.getBoundingClientRect().width;
    if (drawing.mode === "freehand") {
      startFreehand({
        event: e.nativeEvent,
        frame,
        size: format,
        line: line.current,
        onDone: (stroke) => create(fitStroke(stroke, FIT_SCREEN_PX * scale), false),
      });
      return;
    }
    const first = pen.current[0];
    if (first && pen.current.length >= 2) {
      const box = frame.getBoundingClientRect();
      const x = ((first.x + format.width / 2) / format.width) * box.width + box.left;
      const y = ((first.y + format.height / 2) / format.height) * box.height + box.top;
      if (Math.hypot(e.clientX - x, e.clientY - y) <= CLOSE_SCREEN_PX) return finishPen(true);
    }
    startPenPoint({
      event: e.nativeEvent,
      frame,
      size: format,
      points: pen.current,
      line: line.current,
      onChange: () => setCount(pen.current.length),
    });
  };

  return (
    <div
      className="absolute inset-0 cursor-crosshair"
      onPointerDown={onDown}
      onDoubleClick={() => drawing.mode === "pen" && finishPen()}
    >
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox={`${-format.width / 2} ${-format.height / 2} ${format.width} ${format.height}`}
        preserveAspectRatio="none"
      >
        <path
          ref={line}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-border bg-popover p-1 shadow-md"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <SegmentedControl
          label="Draw with"
          options={MODES}
          value={drawing.mode}
          onChange={setMode}
        />
        {drawing.mode === "pen" && (
          <Button size="sm" disabled={count < 2} onClick={() => finishPen()}>
            Done
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={stop}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
