import { cn } from "../lib/cn";

/** A thin bar for work that knows how far along it is. `value` goes from 0 to 1. */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-[3px] bg-foreground/25", className)}
    >
      <div
        className="h-full bg-ice-400 transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
