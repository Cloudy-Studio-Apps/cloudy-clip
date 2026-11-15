import type { MouseEvent } from "react";
import { cn } from "@/ui";
import { shortTime } from "../logic/strip";
import type { StripClip } from "../tint.types";
import { useClipInfo } from "./clip.info.hook";

interface ClipCardProps {
  entry: StripClip;
  /** The clip being graded. */
  current: boolean;
  /** In the timeline's selection (shared with Edit). */
  selected: boolean;
  /** Has a grade at the level the switch shows. */
  graded: boolean;
  /** The name of its shot group, if it is in one. */
  group?: string;
  onPick(event: MouseEvent): void;
}

/** One clip in the strip: picture, number, track, graded mark, shot group, name, start, codec and rate. */
export function ClipCard({ entry, current, selected, graded, group, onPick }: ClipCardProps) {
  const { clip, track, no } = entry;
  const info = useClipInfo(clip);
  return (
    <button
      type="button"
      aria-pressed={current}
      title={`${no} ${info.name}, ${track}. Click to grade it; Ctrl or Shift click to select several.`}
      onClick={onPick}
      className="flex w-32 shrink-0 cursor-pointer flex-col gap-0.5 text-left"
    >
      <span
        className={cn(
          "relative min-h-0 w-full flex-1 overflow-hidden rounded-sm bg-stage",
          current
            ? "shadow-[0_0_0_2px_var(--mark)]"
            : selected
              ? "shadow-[0_0_0_2px_var(--primary)]"
              : "shadow-[0_0_0_1px_var(--border)]",
        )}
      >
        {info.poster && (
          <img src={info.poster} alt="" draggable={false} className="size-full object-cover" />
        )}
        <span className="absolute top-1 left-1 rounded-xs bg-surface-sunken/75 px-1 font-mono text-2xs font-bold">
          {no} · {track}
        </span>
        {graded && (
          <span className="absolute top-1 right-1 rounded-xs bg-surface-sunken/75 px-1 font-mono text-2xs font-bold text-primary">
            ● graded
          </span>
        )}
        {group && (
          <span className="absolute bottom-1 left-1 max-w-[calc(100%-8px)] truncate rounded-xs bg-surface-sunken/75 px-1 font-mono text-2xs">
            {group}
          </span>
        )}
      </span>
      <span className="flex gap-1.5 font-mono text-xs text-muted-foreground">
        <span className="truncate">{info.name}</span>
        <span className="ml-auto text-subtle-foreground">{shortTime(clip.start)}</span>
      </span>
      <span className="h-3 truncate font-mono text-2xs text-subtle-foreground">{info.meta}</span>
    </button>
  );
}
