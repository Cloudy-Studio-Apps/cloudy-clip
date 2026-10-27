import { createStore } from "zustand/vanilla";
import type { ClipId } from "@/modules/project";
import type { TimelineApi, TimelineViewState } from "./timeline.types";

export const MIN_PX_PER_SECOND = 2;
export const MAX_PX_PER_SECOND = 400;

/**
 * Creates the timeline view state (zoom and selection) of one kernel. `partners` gives a clip's
 * linked clips, which are selected with it.
 */
export function createTimelineView(partners: (id: ClipId) => ClipId[] = () => []): TimelineApi {
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
        const group = [id, ...partners(id)];
        if (!additive) return { selection: group };
        return {
          selection: s.selection.includes(id)
            ? s.selection.filter((c) => !group.includes(c))
            : [...s.selection, ...group.filter((c) => !s.selection.includes(c))],
        };
      });
    },
  };
}
