import { useLayoutEffect, useRef } from "react";
import { hueOf } from "../../logic/color/curves.apply";
import { insertPoint, nearestPoint, resetPoint } from "../../logic/color/curves.edit";
import type { CurvePoint, CurveShape, Rgb } from "../../tint.types";
import { startCurveDrag } from "./curve.gesture";
import { paintCurve } from "./curve.paint";
import type { CurveEdit } from "./tools.types";

/** How near a point (px) a press takes it rather than adding one. */
const HIT = 9;

/** The hue strip under a hue curve (data colors): each color where the hue curves read its hue. */
const HUES = (() => {
  const named: [string, Rgb][] = [
    ["red", [1, 0, 0]],
    ["#ff0", [1, 1, 0]],
    ["lime", [0, 1, 0]],
    ["cyan", [0, 1, 1]],
    ["blue", [0, 0, 1]],
    ["#f0f", [1, 0, 1]],
  ];
  const stops = named.map(([css, rgb]) => `${css} ${((hueOf(rgb) ?? 0) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${stops.join(", ")}, red 100%)`;
})();

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
 * A curve over its grid with its points. Click adds a point, drag moves one, drag it off the box
 * removes it, double-click puts it back to neutral. While a point moves, the curve and the live
 * values follow in the DOM; the curve is saved once, on release (Escape cancels).
 */
export function CurveEditor({ points, shape, color, edit }: CurveEditorProps) {
  const box = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const dots = useRef<HTMLDivElement>(null);
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
    if (!edit || !box.current) return;
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
