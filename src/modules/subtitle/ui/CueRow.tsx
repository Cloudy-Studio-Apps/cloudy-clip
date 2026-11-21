import { memo, useEffect, useRef } from "react";
import type { Micros } from "@/core";
import { MARKER_HEX, type Clip, type ClipId, type MarkerColor } from "@/modules/project";
import { cn } from "@/ui";
import { TimeField } from "./TimeField";
import type { useCueEditing } from "./cue.edit.hook";

interface CueRowProps {
  clip: Clip;
  /** Where the row sits in the list and how tall it is, in px. */
  top: number;
  height: number;
  /** The track's name, after its times. */
  trackName: string;
  /** Its style's color. */
  color: MarkerColor;
  /** It has values of its own (differing from its style). */
  own: boolean;
  selected: boolean;
  /** The edge the timing keys nudge, when it is the one selected cue. */
  edge: "start" | "end" | null;
  frame: Micros;
  prev?: ClipId;
  next?: ClipId;
  editing: ReturnType<typeof useCueEditing>;
  onSelect(e: React.MouseEvent, clipId: ClipId): void;
}

/**
 * A row of the cue list: start, end and length (`TimeField`) with the track, the words in place,
 * the style's dot and ◆ when the cue has values of its own. The row under the playhead is marked
 * by the list through `data-now`, not by React.
 */
export const CueRow = memo(function CueRow({
  clip,
  top,
  height,
  trackName,
  color,
  own,
  selected,
  edge,
  frame,
  prev,
  next,
  editing,
  onSelect,
}: CueRowProps) {
  const text = String(clip.props.text ?? "");
  const wordsRef = useRef<HTMLTextAreaElement>(null);
  // Words written elsewhere (a split, an undo, an agent) replace what the field shows.
  useEffect(() => {
    if (wordsRef.current) wordsRef.current.value = text;
  }, [text]);

  return (
    <div
      data-cue={clip.id}
      aria-selected={selected}
      onClick={(e) => onSelect(e, clip.id)}
      className={cn(
        "group absolute inset-x-0 grid cursor-pointer grid-cols-[4px_96px_minmax(0,1fr)_14px] gap-2 border-b border-border pr-2 hover:bg-hover",
        selected && "bg-muted",
      )}
      style={{ top, height }}
    >
      <i className="group-data-[now]:bg-mark" />
      <div className="py-1.5 font-mono text-xs leading-snug text-subtle-foreground">
        <TimeField
          clip={clip}
          field="start"
          frame={frame}
          active={edge === "start"}
          className="block text-sm font-bold text-muted-foreground group-data-[now]:text-mark"
        />
        <TimeField clip={clip} field="end" frame={frame} active={edge === "end"} />
        <span className="block truncate">
          <TimeField clip={clip} field="length" frame={frame} active={false} /> · {trackName}
        </span>
      </div>
      <textarea
        ref={wordsRef}
        defaultValue={text}
        spellCheck={false}
        aria-label="Words"
        onClick={(e) => e.stopPropagation()}
        onFocus={() => editing.onFocus(clip.id)}
        onBlur={(e) => editing.onBlur(clip.id, e.currentTarget)}
        onKeyDown={(e) => editing.onKeyDown(e, clip.id, { prev, next })}
        className="my-1.5 resize-none rounded-xs bg-transparent px-1 text-sm leading-snug text-foreground outline-none focus:bg-background focus:shadow-[inset_0_0_0_1px_var(--border-strong)]"
      />
      <div className="flex flex-col items-center gap-1 pt-2.5">
        <i className="size-[9px] rounded-xs" style={{ backgroundColor: MARKER_HEX[color] }} />
        {own && (
          <em title="Has values of its own" className="text-2xs not-italic leading-none text-mark">
            ◆
          </em>
        )}
      </div>
    </div>
  );
});
