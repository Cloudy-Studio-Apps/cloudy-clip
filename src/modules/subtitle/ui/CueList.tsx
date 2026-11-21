import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { elementRef } from "@/modules/element";
import { previewRef, seek } from "@/modules/preview";
import {
  frameDuration,
  projectRef,
  useOpenFormat,
  type Clip,
  type ClipId,
} from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { EmptyState, visibleWindow } from "@/ui";
import { ownPaths } from "../logic/overrides";
import { subtitleRef } from "../subtitle.ref";
import { CueRow } from "./CueRow";
import { useCueEditing } from "./cue.edit.hook";
import { useNowRow } from "./now.row.hook";

const ROW_HEIGHT = 64;
const OVERSCAN = 6;

/**
 * Every cue of the open composition, by start, as rows of 64 px drawn only near the view. A click
 * selects a cue and seeks to it (Ctrl adds or removes one, Shift takes a range); the row under the
 * playhead is marked from the playback clock without React renders; `view.focus` puts the cursor
 * in a row, scrolling it into view first.
 */
export function CueList({ cues }: { cues: readonly Clip[] }) {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const elements = useModule(elementRef);
  const timeline = useModule(timelineRef);
  const { playback } = useModule(previewRef);
  const { view } = useModule(subtitleRef);
  const editing = useCueEditing();
  const format = useOpenFormat();
  const frame = frameDuration(format);
  const tracks = useStore(project.api, (s) => s.tracks);
  const styles = useStore(project.api, (s) => s.subtitleStyles);
  const selection = useStore(timeline.view, (s) => s.selection);
  const edge = useStore(view, (s) => s.edge);
  const focus = useStore(view, (s) => s.focus);
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ top: 0, height: 1200 });
  const { start, end } = visibleWindow(box.top, box.height, ROW_HEIGHT, cues.length, OVERSCAN);
  const measure = (el: HTMLElement) =>
    setBox((b) =>
      b.top === el.scrollTop && b.height === el.clientHeight
        ? b
        : { top: el.scrollTop, height: el.clientHeight },
    );
  const empty = cues.length === 0;
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const resize = new ResizeObserver(() => measure(list));
    resize.observe(list);
    return () => resize.disconnect();
  }, [empty]);
  useNowRow(listRef, cues, playback);

  // Put the cursor in the asked row once it is drawn; scroll to it first when it isn't.
  useEffect(() => {
    const list = listRef.current;
    if (!focus || !list) return;
    const index = cues.findIndex((c) => c.id === focus.clipId);
    if (index < 0) return;
    const field = list.querySelector<HTMLTextAreaElement>(`[data-cue="${focus.clipId}"] textarea`);
    if (!field) {
      list.scrollTop = Math.max(0, index * ROW_HEIGHT - list.clientHeight / 2);
      return;
    }
    view.setState({ focus: null });
    field.focus();
    if (focus.caret === "all") field.select();
    else {
      const at = focus.caret === "end" ? field.value.length : focus.caret;
      field.setSelectionRange(at, at);
    }
    const top = index * ROW_HEIGHT;
    if (top < list.scrollTop || top + ROW_HEIGHT > list.scrollTop + list.clientHeight) {
      list.scrollTop = top;
    }
  }, [focus, cues, start, end, view]);

  const onSelect = useCallback(
    (e: React.MouseEvent, clipId: ClipId) => {
      view.setState({ tab: "cue" });
      const selected = timeline.view.getState().selection;
      if (e.ctrlKey || e.metaKey) return timeline.selectClip(clipId, true);
      const anchor = selected.at(-1);
      const from = cues.findIndex((c) => c.id === anchor);
      const to = cues.findIndex((c) => c.id === clipId);
      if (e.shiftKey && from >= 0) {
        const range = cues.slice(Math.min(from, to), Math.max(from, to) + 1);
        timeline.selectClip(null);
        for (const cue of range) timeline.selectClip(cue.id, true);
        return;
      }
      timeline.selectClip(clipId);
      const clip = project.getState().clips[clipId];
      if (clip) void bus.run(seek, { time: clip.start });
    },
    [bus, cues, project, timeline, view],
  );

  if (empty) {
    return (
      <EmptyState className="m-3" title="No subtitles yet">
        Import an .srt, add a cue, or mark a text clip as a subtitle in Edit.
      </EmptyState>
    );
  }
  const single = selection.length === 1 ? selection[0] : undefined;
  return (
    <div
      ref={listRef}
      className="relative min-h-0 flex-1 overflow-y-auto"
      onScroll={(e) => measure(e.currentTarget)}
    >
      <div className="relative" style={{ height: cues.length * ROW_HEIGHT }}>
        {cues.slice(start, end).map((clip, i) => {
          const index = start + i;
          const style = clip.subtitle && styles?.[clip.subtitle.styleId];
          if (!style) return null;
          return (
            <CueRow
              key={clip.id}
              clip={clip}
              top={index * ROW_HEIGHT}
              height={ROW_HEIGHT}
              trackName={tracks[clip.trackId]?.name ?? ""}
              color={style.color}
              own={ownPaths(elements.resolve(clip, format), style).length > 0}
              selected={selection.includes(clip.id)}
              edge={single === clip.id ? edge : null}
              frame={frame}
              prev={cues[index - 1]?.id}
              next={cues[index + 1]?.id}
              editing={editing}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
