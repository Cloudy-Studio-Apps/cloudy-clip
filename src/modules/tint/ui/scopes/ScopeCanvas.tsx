import { useEffect, useRef } from "react";
import { drawScope } from "./scope.draw";
import type { DrawnScope } from "./scopes.types";
import { useDemoPixels } from "./pixels.hook";

/** One scope on a canvas, redrawn when its kind or its size changes (never per frame here). */
export function ScopeCanvas({ kind }: { kind: DrawnScope }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pixels = useDemoPixels();
  useEffect(() => {
    const el = canvas.current;
    if (!el || !pixels) return;
    const paint = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(10, Math.round(el.clientWidth * ratio));
      const height = Math.max(10, Math.round(el.clientHeight * ratio));
      el.width = width;
      el.height = height;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const grid = getComputedStyle(el).getPropertyValue("--border").trim() || "#33383f";
      drawScope(ctx, kind, pixels, width, height, grid);
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(el);
    return () => observer.disconnect();
  }, [kind, pixels]);
  const scale = kind === "parade" || kind === "wave";
  return (
    <div className="relative min-h-0 overflow-hidden rounded-sm bg-stage shadow-[0_0_0_1px_var(--border)]">
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      {scale &&
        (["1023", "512", "0"] as const).map((label, i) => (
          <span
            key={label}
            className="pointer-events-none absolute left-1 font-mono text-2xs text-subtle-foreground"
            style={{ top: `calc(${i * 50}% - ${i * 7}px)` }}
          >
            {label}
          </span>
        ))}
    </div>
  );
}
