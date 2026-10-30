import { cn } from "@/ui";
import type { CutPreview } from "../timeline.types";
import { chipBox } from "./junction.gesture";

interface CutPreviewMarkProps {
  preview: CutPreview;
  pxPerSecond: number;
}

/**
 * Where a junction dragged over a cut will land: the chip at its real size and a tag with its
 * name and length. The clips it would move show in their new place (`CutPreview.shifts`).
 */
export function CutPreviewMark({ preview, pxPerSecond }: CutPreviewMarkProps) {
  const { cut, duration, fits, label, icon: Icon } = preview;
  const leftEnd = cut.left.start + cut.left.duration;
  const box = chipBox(leftEnd, duration, pxPerSecond);
  const seconds = (duration / 1_000_000).toFixed(2);
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div
        className={cn(
          "absolute bottom-[3px] top-[3px] rounded-md border-2",
          fits ? "border-primary bg-primary-soft" : "border-destructive bg-destructive-soft",
        )}
        style={{ left: box.left, width: box.width }}
      />
      <div
        className={cn(
          "absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-xs px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap shadow-popover",
          fits ? "bg-primary text-primary-foreground" : "bg-destructive text-primary-foreground",
        )}
        style={{ left: box.left + box.width / 2 }}
      >
        {Icon && <Icon className="size-3 shrink-0" aria-hidden />}
        {fits ? `${label} · ${seconds}s` : `${label} doesn't fit here`}
      </div>
    </div>
  );
}
