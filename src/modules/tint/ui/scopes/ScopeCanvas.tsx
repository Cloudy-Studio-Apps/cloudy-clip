import type { Ref } from "react";
import type { DrawnScope } from "./scopes.types";

/** One scope's canvas, drawn by the panel's loop. Its pixel size follows its box (the panel resizes it). */
export function ScopeCanvas({ kind, ref }: { kind: DrawnScope; ref: Ref<HTMLCanvasElement> }) {
  const scale = kind === "parade" || kind === "wave";
  return (
    <div className="relative min-h-0 overflow-hidden rounded-sm bg-stage shadow-[0_0_0_1px_var(--border)]">
      <canvas ref={ref} className="absolute inset-0 size-full" />
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
