import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { notify, useKernel, useModule } from "@/core";
import { startFreehand, startPenPoint } from "@/modules/path";
import { fitStroke, useOpenFormat, type PathPoint } from "@/modules/project";
import { Button, SegmentedControl } from "@/ui";
import { frameMapping, invertible, pointsToMask } from "../logic/mapping";
import { addMask } from "../mask.commands";
import { maskRef } from "../mask.ref";
import { useMaskSubject } from "./mask.subject.hook";

/** How far a freehand fit may stray from the stroke, and how near the first point a click closes, in screen px. */
const FIT_SCREEN_PX = 4;
const CLOSE_SCREEN_PX = 8;

const MODES = [
  { value: "freehand", label: "Freehand" },
  { value: "pen", label: "Pen" },
] as const;

/** Mask space itself: frame points mapped straight into it. */
const ORIGIN = { x: 0, y: 0, rotation: 0 };

/** The points without ones stacked on the same spot (a double-click), the last merged into the first when it closes there. */
function distinct(points: readonly PathPoint[], close: number): PathPoint[] {
  const kept = points.filter(
    (p, i) => i === 0 || Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y) >= 1,
  );
  const first = kept[0];
  const last = kept[kept.length - 1];
  if (kept.length > 3 && first && last && Math.hypot(last.x - first.x, last.y - first.y) <= close) {
    kept[0] = { ...first, inX: last.inX, inY: last.inY };
    kept.pop();
  }
  return kept;
}

/** The drawing layer, mounted only while drawing: what it needs follows every frame. */
export function MaskDrawing() {
  const { ui } = useModule(maskRef);
  const drawing = useStore(ui, (s) => s.drawing !== null);
  return drawing ? <DrawingLayer /> : null;
}

/**
 * Drawing a new path mask on the selected clip (`ui.drawing`, set by the Mask tab's Pen and
 * Freehand). Freehand: one stroke, fitted into a few smooth points, closed on release. Pen: a click
 * adds a corner, a click-drag pulls its handles, a click on the first point, Enter, a double-click or
 * Done closes it; Escape or Cancel stops. Three or more points send one `mask.add` with them in mask
 * space, and the new mask is selected.
 */
function DrawingLayer() {
  const { bus } = useKernel();
  const { ui } = useModule(maskRef);
  const drawing = useStore(ui, (s) => s.drawing);
  const format = useOpenFormat();
  const { clip, layer } = useMaskSubject();
  const mapping = useMemo(
    () => layer && frameMapping(format, layer.source, layer.transform),
    [format, layer],
  );
  const ready =
    drawing !== null && clip !== undefined && mapping !== undefined && invertible(mapping);
  const line = useRef<SVGPathElement>(null);
  const pen = useRef<PathPoint[]>([]);
  const [count, setCount] = useState(0);

  const stop = () => {
    pen.current = [];
    setCount(0);
    line.current?.setAttribute("d", "");
    ui.setState({ drawing: null });
  };

  const create = (points: PathPoint[], close: number) => {
    stop();
    const kept = distinct(points, close);
    if (!clip || !mapping || kept.length < 3) return;
    const clipId = clip.id;
    const mapped = pointsToMask(mapping, ORIGIN, 1, kept);
    void bus.run(addMask, { clipIds: [clipId], points: mapped }).then((result) => {
      if (!result.ok) return notify("error", result.error.message);
      const { maskIds } = result.value as { maskIds: Record<string, string> };
      const maskId = maskIds[clipId];
      if (maskId) ui.setState({ selectedMaskId: maskId, selectedPointId: null });
    });
  };

  useEffect(() => {
    if (drawing === null || ready) return;
    notify("error", "Put the playhead over the selected picture clip to draw a mask on it.");
    ui.setState({ drawing: null });
  }, [drawing, ready, ui]);

  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "Enter" && drawing?.mode === "pen") create(pen.current, 0);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!ready || drawing === null) return null;

  const setMode = (mode: "freehand" | "pen") => {
    pen.current = [];
    setCount(0);
    line.current?.setAttribute("d", "");
    ui.setState({ drawing: { mode } });
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const frame = e.currentTarget;
    if (e.button !== 0 || !line.current) return;
    e.preventDefault();
    e.stopPropagation();
    const scale = format.width / frame.getBoundingClientRect().width;
    if (drawing.mode === "freehand") {
      startFreehand({
        event: e.nativeEvent,
        frame,
        size: format,
        line: line.current,
        onDone: (stroke) =>
          create(fitStroke(stroke, FIT_SCREEN_PX * scale), CLOSE_SCREEN_PX * scale),
      });
      return;
    }
    const first = pen.current[0];
    if (first && pen.current.length >= 3) {
      const box = frame.getBoundingClientRect();
      const x = ((first.x + format.width / 2) / format.width) * box.width + box.left;
      const y = ((first.y + format.height / 2) / format.height) * box.height + box.top;
      if (Math.hypot(e.clientX - x, e.clientY - y) <= CLOSE_SCREEN_PX) {
        return create(pen.current, 0);
      }
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
      className="pointer-events-auto absolute inset-0 cursor-crosshair"
      onPointerDown={onDown}
      onDoubleClick={() => drawing.mode === "pen" && create(pen.current, 0)}
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
          label="Draw mask with"
          options={MODES}
          value={drawing.mode}
          onChange={setMode}
        />
        {drawing.mode === "pen" && (
          <Button size="sm" disabled={count < 3} onClick={() => create(pen.current, 0)}>
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
