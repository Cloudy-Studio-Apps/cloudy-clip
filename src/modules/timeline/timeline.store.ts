import { createStore } from "zustand/vanilla";
import type { ClipId } from "@/modules/project";
import type { TimelineViewState } from "./timeline.types";

export const MIN_PX_PER_SECOND = 2;
export const MAX_PX_PER_SECOND = 400;

/** Zoom and selection. */
export const timelineViewStore = createStore<TimelineViewState>()(() => ({
  pxPerSecond: 60,
  selection: [],
}));

/** Sets the zoom, clamped to the allowed range. */
export function setZoom(pxPerSecond: number): void {
  const clamped = Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, pxPerSecond));
  timelineViewStore.setState({ pxPerSecond: clamped });
}

/** Replaces the selection, or toggles one clip in it when `additive` is set. */
export function selectClip(id: ClipId | null, additive = false): void {
  timelineViewStore.setState((s) => {
    if (id === null) return { selection: [] };
    if (!additive) return { selection: [id] };
    return {
      selection: s.selection.includes(id)
        ? s.selection.filter((c) => c !== id)
        : [...s.selection, id],
    };
  });
}
