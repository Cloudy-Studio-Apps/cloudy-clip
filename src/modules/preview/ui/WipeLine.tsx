import { useLayoutEffect, useRef, type PointerEvent } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { previewRef } from "../preview.ref";

/**
 * The compare wipe over the frame: left of the line the picture without filters, right of it with
 * them. Dragging moves the line through `--wipe` (no React state) and sets the compare on release,
 * when the frame is drawn again there.
 */
export function WipeLine() {
  const { picture } = useModule(previewRef);
  const compare = useStore(picture.view, (s) => s.compare);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragged = useRef<number | null>(null);

  useLayoutEffect(() => {
    boxRef.current?.style.setProperty("--wipe", String(compare ?? 0.5));
  }, [compare]);

  const at = (event: PointerEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    return Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (dragged.current === null) return;
    const wipe = at(event);
    if (wipe === null) return;
    dragged.current = wipe;
    boxRef.current?.style.setProperty("--wipe", String(wipe));
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    const wipe = dragged.current;
    dragged.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (wipe !== null) picture.setCompare(wipe);
  };

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0">
      <div
        role="slider"
        aria-label="Compare"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((compare ?? 0.5) * 100)}
        className="pointer-events-auto absolute inset-y-0 w-4 -translate-x-1/2 cursor-ew-resize touch-none"
        style={{ left: "calc(var(--wipe) * 100%)" }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragged.current = compare ?? 0.5;
        }}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/80" />
        <div className="absolute left-1/2 top-1/2 h-6 w-2 -translate-x-1/2 -translate-y-1/2 rounded-xs border border-black/40 bg-white" />
      </div>
    </div>
  );
}
