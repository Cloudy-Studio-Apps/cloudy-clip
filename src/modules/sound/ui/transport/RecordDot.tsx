import { cn } from "@/ui";

/** The record mark: a small square in the text's colour, pulsing while it records. */
export function RecordDot({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-xs bg-current", pulsing && "animate-pulse")}
    />
  );
}
