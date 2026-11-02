import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  animatedClip,
  clampToClip,
  type Clip,
  type KeyTrack,
  type KeyValue,
} from "@/modules/project";
import { cn } from "@/ui";
import { PANEL_HEADER_WIDTH, ROW_HEIGHT } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import type { KeyField, PanelWindow } from "../keyframe.types";
import { KeyBand } from "./KeyBand";
import { KeyControls } from "./KeyAction";

/** A value as the row shows it: numbers to two decimals, colors as they are. */
function formatValue(value: KeyValue): string {
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  if (typeof value === "boolean") return value ? "On" : "Off";
  return value;
}

interface PropertyRowProps {
  clip: Clip;
  field: KeyField;
  track: KeyTrack;
  scale: PanelWindow;
  selectedIds: ReadonlySet<string>;
}

/**
 * One animated field of a clip: swatch, name, value at the playhead, previous key, diamond and
 * next key on the left, and its keys along the timeline on the right.
 */
export function PropertyRow({ clip, field, track, scale, selectedIds }: PropertyRowProps) {
  const { playback } = useModule(previewRef);
  const { view } = useModule(keyframeRef);
  const id = `${clip.id}:${field.path}`;
  const primary = useStore(view, (s) => s.primary === id);
  const shown = useStore(view, (s) => s.shown.includes(id));
  const paths = useMemo(() => [field.path], [field.path]);
  const value = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const update = () => {
      const el = value.current;
      if (!el) return;
      const at = clampToClip(clip, playback.getTime());
      el.textContent = formatValue(field.read(animatedClip(clip, at)));
    };
    update();
    return playback.onTime(update);
  }, [clip, field, playback]);

  return (
    <div className="flex border-b border-border" style={{ height: ROW_HEIGHT }}>
      <div
        data-field-row
        onClick={() => view.setState({ primary: id })}
        className={cn(
          "group/cell grid shrink-0 cursor-pointer grid-cols-[10px_minmax(0,1fr)_56px_auto] items-center gap-1 border-r-[1.5px] border-border-strong bg-muted pl-2 pr-1 text-sm text-muted-foreground hover:text-foreground",
          primary && "bg-accent-soft text-foreground shadow-[inset_2px_0_0_var(--on)]",
        )}
        style={{ width: PANEL_HEADER_WIDTH }}
      >
        <i className={cn("h-0.5 w-2", shown ? "bg-on" : "bg-subtle-foreground")} />
        <span className="truncate">{field.label}</span>
        <span
          ref={value}
          className="truncate text-right font-mono text-xs font-bold text-foreground group-data-[key-state=animated]/cell:text-on group-data-[key-state=on-key]/cell:text-mark"
        />
        <KeyControls clipId={clip.id} paths={paths} />
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <KeyBand
          clip={clip}
          path={field.path}
          track={track}
          scale={scale}
          selectedIds={selectedIds}
        />
      </div>
    </div>
  );
}
