import { useLayoutEffect, useRef } from "react";
import { insertPoint, nearestPoint, resetPoint } from "../../logic/color/curves.edit";
import type { CurvePoint, CurveShape } from "../../tint.types";
import { startCurveDrag } from "./curve.gesture";
import { paintCurve } from "./curve.paint";
import { HUE_STOPS } from "./hue.stops";
import type { CurveEdit } from "./tools.types";

/** How near a point (px) a press takes it rather than adding one. */
const HIT = 9;

/** How long (ms) after a click added a point a double-click belongs to that click (no reset). */
const ADDED_DOUBLE = 600;

/** The hue strip under a hue curve (data colors): each color where the hue curves read its hue. */
const HUES = `linear-gradient(90deg, ${HUE_STOPS})`;

/** The brightness strip under Brightness vs Saturation (data colors). */
const GRAYS = "linear-gradient(90deg, #000, #fff)";

const same = (a: readonly CurvePoint[], b: readonly CurvePoint[]) =>
  JSON.stringify(a) === JSON.stringify(b);

interface CurveEditorProps {
  points: readonly CurvePoint[];
  shape: CurveShape;
  /** Stroke of the curve. */
  color: string;
  /** Makes the curve editable. Without it the editor only shows it. */
  edit?: CurveEdit;
}

/**
 * A curve over its grid with its points. Click adds a point, drag moves one (from where it was
 * grabbed), drag it off the box removes it, double-click puts it back to neutral. A click on a
 * point sends nothing; a double-click sends one command, to reset or (on empty space) to add. While a point moves, the curve and the live
 * values follow in the DOM; the curve is saved once, on release (Escape cancels).
 */
export function CurveEditor({ points, shape, color, edit }: CurveEditorProps) {
  const box = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const dots = useRef<HTMLDivElement>(null);
  /** When the last click added a point, so the double-click it starts doesn't reset that point. */
  const added = useRef(-Infinity);
  const paint = (next: readonly CurvePoint[]) => {
    if (path.current && dots.current) paintCurve(path.current, dots.current, next, shape);
  };
  useLayoutEffect(() => {
    if (path.current && dots.current) paintCurve(path.current, dots.current, points, shape);
  }, [points, shape]);

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = box.current!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
      reach: { x: HIT / rect.width, y: HIT / rect.height },
    };
  };

  const down = (event: React.PointerEvent) => {
    if (!edit || event.button !== 0 || !box.current) return;
    event.preventDefault();
    const { x, y, reach } = local(event);
    let start: readonly CurvePoint[] = points;
    let index = nearestPoint(points, x, y, reach);
    if (index < 0) {
      const placed = insertPoint(points, x, y);
      if (!placed) return;
      start = placed.points;
      index = placed.index;
      added.current = event.timeStamp;
    }
    startCurveDrag({
      event: event.nativeEvent,
      box: box.current,
      points: start,
      index,
      shape,
      onMove(next) {
        paint(next);
        edit.preview(next);
      },
      onEnd(next) {
        if (!next || same(next, points)) {
          paint(points);
          edit.cancel();
        } else edit.commit(next);
      },
    });
  };

  const reset = (event: React.MouseEvent) => {
    if (!edit || !box.current || event.timeStamp - added.current < ADDED_DOUBLE) return;
    const { x, y, reach } = local(event);
    const index = nearestPoint(points, x, y, reach);
    if (index < 0) return;
    const next = resetPoint(points, index, shape);
    if (!same(next, points)) edit.commit(next);
  };

  const strip = shape === "hue" ? HUES : shape === "flat" ? GRAYS : null;
  return (
    <div
      ref={box}
      onPointerDown={down}
      onDoubleClick={reset}
      className="relative h-[220px] touch-none rounded-sm bg-background shadow-[inset_0_0_0_1px_var(--border)]"
      style={{ cursor: edit ? "crosshair" : undefined }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 size-full"
      >
        {[25, 50, 75].map((at) => (
          <path
            key={at}
            d={`M0 ${at}H100M${at} 0V100`}
            stroke="var(--border)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={shape === "tone" ? "M0 100L100 0" : "M0 50H100"}
          stroke="var(--border-strong)"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <path
          ref={path}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div ref={dots} className="pointer-events-none absolute inset-0" />
      {strip && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2.5 opacity-80"
          style={{ background: strip }}
        />
      )}
    </div>
  );
}
