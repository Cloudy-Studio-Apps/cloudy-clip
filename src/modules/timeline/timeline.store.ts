import { createStore } from "zustand/vanilla";
import type { TimelineApi, TimelineViewState } from "./timeline.types";

export const MIN_PX_PER_SECOND = 2;
export const MAX_PX_PER_SECOND = 400;

/** Creates the timeline view state (zoom and selection) of one kernel. */
export function createTimelineView(): TimelineApi {
  const view = createStore<TimelineViewState>()(() => ({ pxPerSecond: 60, selection: [] }));
  return {
    view,
    setZoom(pxPerSecond) {
      const clamped = Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, pxPerSecond));
      view.setState({ pxPerSecond: clamped });
    },
    selectClip(id, additive = false) {
      view.setState((s) => {
        if (id === null) return { selection: [] };
        if (!additive) return { selection: [id] };
        return {
          selection: s.selection.includes(id)
            ? s.selection.filter((c) => c !== id)
            : [...s.selection, id],
        };
      });
    },
  };
}
