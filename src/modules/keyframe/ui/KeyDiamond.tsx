import { cn } from "@/ui";

interface KeyDiamondProps {
  /** Distance from time 0, in px. */
  x: number;
  /** `clipId|path|keyId`, for the pointer tools. */
  keyRef?: string;
  /** `clipId|time` of a summary diamond, for the pointer tools. */
  summaryKey?: string;
  /** In a clip's summary row: smaller and grey, for every key at a time. */
  summary?: boolean;
  /** A key the selection holds: filled red. */
  selected?: boolean;
  /** A key of a track that jumps (a square). */
  step?: boolean;
  /** A key with an ease other than linear (rounded corners). */
  eased?: boolean;
  /** A key past the clip's ends. */
  outside?: boolean;
  title?: string;
}

/** One key in a band: a rotated square at its time. */
export function KeyDiamond({
  x,
  keyRef,
  summaryKey,
  summary,
  selected,
  step,
  eased,
  outside,
  title,
}: KeyDiamondProps) {
  return (
    <i
      data-key-ref={keyRef}
      data-key-summary={summaryKey}
      data-selected={selected ? "true" : undefined}
      title={title}
      className={cn(
        "absolute block cursor-pointer",
        summary ? "top-2 -ml-1 size-2" : "top-[7px] -ml-[5px] size-2.5",
        !step && "rotate-45",
        eased && "rounded-xs",
        outside && "opacity-40",
        selected
          ? "bg-mark"
          : summary
            ? "bg-muted-foreground hover:bg-foreground"
            : "bg-surface shadow-[inset_0_0_0_1.5px_var(--foreground)] hover:shadow-[inset_0_0_0_1.5px_var(--on)]",
      )}
      style={{ left: x }}
    />
  );
}
