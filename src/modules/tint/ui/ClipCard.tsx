import { cn } from "@/ui";
import type { DemoClip } from "./demo/demo.types";

/** One clip in the strip: picture, number, track, graded mark, name, start, codec and rate. */
export function ClipCard({ clip, current }: { clip: DemoClip; current: boolean }) {
  return (
    <button
      type="button"
      title={`${clip.no} ${clip.name}, ${clip.track}. Click to grade it; Ctrl or Shift click to select several.`}
      className="flex w-32 shrink-0 cursor-pointer flex-col gap-0.5 text-left"
    >
      <span
        className={cn(
          "relative min-h-0 w-full flex-1 overflow-hidden rounded-sm",
          current ? "shadow-[0_0_0_2px_var(--mark)]" : "shadow-[0_0_0_1px_var(--border)]",
        )}
      >
        <img src={clip.image} alt="" draggable={false} className="size-full object-cover" />
        <span className="absolute top-1 left-1 rounded-xs bg-surface-sunken/75 px-1 font-mono text-2xs font-bold">
          {clip.no} · {clip.track}
        </span>
        {clip.graded && (
          <span className="absolute top-1 right-1 rounded-xs bg-surface-sunken/75 px-1 font-mono text-2xs font-bold text-primary">
            ● graded
          </span>
        )}
      </span>
      <span className="flex gap-1.5 font-mono text-xs text-muted-foreground">
        <span className="truncate">{clip.name}</span>
        <span className="ml-auto text-subtle-foreground">{clip.start}</span>
      </span>
      <span className="truncate font-mono text-2xs text-subtle-foreground">{clip.meta}</span>
    </button>
  );
}
