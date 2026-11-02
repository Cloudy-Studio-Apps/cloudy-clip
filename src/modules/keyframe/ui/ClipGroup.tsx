import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { elementRef } from "@/modules/element";
import { projectRef } from "@/modules/project";
import { timeToPx } from "@/modules/timeline";
import { GROUP_HEIGHT, PANEL_HEADER_WIDTH } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import type { PanelClip, PanelWindow } from "../keyframe.types";
import { keysInWindow, summaryTimes } from "../logic/range";
import { KeyDiamond } from "./KeyDiamond";
import { SCROLLED } from "./KeyBand";
import { PropertyRow } from "./PropertyRow";

interface ClipGroupProps {
  entry: PanelClip;
  scale: PanelWindow;
  selectedIds: ReadonlySet<string>;
}

/** A clip of the panel: a fold arrow, its name and a summary band, then a row per animated field. */
export function ClipGroup({ entry, scale, selectedIds }: ClipGroupProps) {
  const { clip, fields } = entry;
  const { view } = useModule(keyframeRef);
  const elements = useModule(elementRef);
  const project = useModule(projectRef).store;
  const folded = useStore(view, (s) => s.folded.includes(clip.id));
  const name = useStore(
    project.api,
    (s) =>
      elements
        .get(clip.kind)
        ?.definition.display(clip, { project: s, track: s.tracks[clip.trackId] }).label ??
      clip.kind,
  );
  const { pxPerSecond, from, to } = scale;
  const times = useMemo(
    () =>
      summaryTimes(
        fields.flatMap(({ path }) => {
          const track = clip.animation?.[path];
          return track ? keysInWindow(track, clip, from, to) : [];
        }),
      ),
    [fields, clip, from, to],
  );
  const Arrow = folded ? ChevronRight : ChevronDown;

  return (
    <>
      <div className="flex border-b border-border bg-surface" style={{ height: GROUP_HEIGHT }}>
        <button
          type="button"
          onClick={() =>
            view.setState((s) => ({
              folded: s.folded.includes(clip.id)
                ? s.folded.filter((id) => id !== clip.id)
                : [...s.folded, clip.id],
            }))
          }
          className="flex shrink-0 cursor-pointer items-center gap-1 border-r-[1.5px] border-border-strong px-2 text-left font-hand text-sm font-bold text-muted-foreground hover:text-foreground"
          style={{ width: PANEL_HEADER_WIDTH }}
        >
          <Arrow className="size-3 shrink-0" />
          <span className="truncate">{name}</span>
        </button>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-0 will-change-transform" style={SCROLLED}>
            <i
              className="absolute inset-y-[5px] bg-primary-soft/40 shadow-[inset_0_0_0_1px_var(--border-strong)]"
              style={{
                left: timeToPx(clip.start, pxPerSecond),
                width: timeToPx(clip.duration, pxPerSecond),
              }}
            />
            {times.map((time) => (
              <KeyDiamond
                key={time}
                summary
                x={timeToPx(time, pxPerSecond)}
                title="Every key of this clip at this time"
              />
            ))}
          </div>
        </div>
      </div>
      {!folded &&
        fields.map((field) => {
          const track = clip.animation?.[field.path];
          return track ? (
            <PropertyRow
              key={field.path}
              clip={clip}
              field={field}
              track={track}
              scale={scale}
              selectedIds={selectedIds}
            />
          ) : null;
        })}
    </>
  );
}
