import { Captions, CaptionsOff } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import { report, type ModuleContext } from "@/core";
import { projectRef, stylesOf, type Clip } from "@/modules/project";
import { isTextClip } from "@/modules/text";
import type { ClipActions, ClipMenuEntry, TimelineViewState } from "@/modules/timeline";
import { mark, unmark } from "./subtitle.mark.commands";

const scopes = ["all", "subtitle"] as const;

/**
 * A text clip's menu: Mark as subtitle (unmarked), or Subtitle style ▸ (the composition's styles)
 * and Remove from subtitles (marked). Each acts on the selected clips of the same kind.
 */
export function subtitleMenu(ctx: ModuleContext, view: StoreApi<TimelineViewState>): ClipActions {
  const run = (promise: Promise<Parameters<typeof report>[0]>) => void promise.then(report);
  return {
    id: "subtitle.clip",
    scopes,
    items(clip) {
      if (!isTextClip(clip)) return [];
      const state = ctx.require(projectRef).store.getState();
      const marked = clip.subtitle !== undefined;
      const clipIds = view.getState().selection.filter((id) => {
        const one: Clip | undefined = state.clips[id];
        return one !== undefined && isTextClip(one) && (one.subtitle !== undefined) === marked;
      });
      if (!marked) {
        return [
          {
            group: "edit",
            scopes,
            icon: Captions,
            label: "Mark as subtitle",
            onSelect: () => run(ctx.bus.run(mark, { clipIds })),
          },
        ];
      }
      const compositionId = state.tracks[clip.trackId]?.compositionId;
      const styles = compositionId ? stylesOf(state, compositionId) : [];
      const entries: ClipMenuEntry[] = [
        {
          group: "edit",
          scopes,
          icon: Captions,
          label: "Subtitle style",
          items: styles.map((style) => ({
            label: style.id === clip.subtitle?.styleId ? `${style.name}  ✓` : style.name,
            onSelect: () => run(ctx.bus.run(mark, { clipIds, styleId: style.id })),
          })),
        },
        {
          group: "edit",
          scopes,
          icon: CaptionsOff,
          label: "Remove from subtitles",
          onSelect: () => run(ctx.bus.run(unmark, { clipIds })),
        },
      ];
      return entries;
    },
  };
}
