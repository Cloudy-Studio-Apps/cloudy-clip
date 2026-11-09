import { useRef } from "react";

interface NumberScrubProps {
  prefix: string;
  /** The number when a drag starts. */
  read(): number;
  bounds: { min: number; max: number; step: number };
  /** Fires on every pixel moved; no re-render happens while dragging. */
  onStep(value: number): void;
  /** Fires once, on release. */
  onEnd(value: number): void;
  /** A double click on the label puts the number back to this (`onStep`, then `onEnd`). */
  resetTo?: number;
}

/** A short label that changes a number when dragged sideways (one step per pixel); a double click resets it when `resetTo` is given. */
export function NumberScrub({ prefix, read, bounds, onStep, onEnd, resetTo }: NumberScrubProps) {
  const drag = useRef<{ x: number; start: number; last: number } | null>(null);
  return (
    <span
      className="cursor-ew-resize touch-none select-none font-mono text-2xs font-semibold text-primary"
      title={resetTo === undefined ? "Drag to change" : "Drag to change, double-click to reset"}
      onDoubleClick={() => {
        if (resetTo === undefined) return;
        onStep(resetTo);
        onEnd(resetTo);
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const start = read();
        drag.current = { x: event.clientX, start, last: start };
      }}
      onPointerMove={(event) => {
        const at = drag.current;
        if (!at) return;
        const raw = at.start + (event.clientX - at.x) * bounds.step;
        const snapped = Math.round(raw / bounds.step) * bounds.step;
        at.last = Math.min(bounds.max, Math.max(bounds.min, Number(snapped.toFixed(6))));
        onStep(at.last);
      }}
      onPointerUp={() => {
        const at = drag.current;
        drag.current = null;
        if (at) onEnd(at.last);
      }}
      onPointerCancel={() => {
        const at = drag.current;
        drag.current = null;
        if (at) onEnd(at.start);
      }}
    >
      {prefix}
    </span>
  );
}
