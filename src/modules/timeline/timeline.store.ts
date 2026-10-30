import { createStore } from "zustand/vanilla";
import type { ClipId, ProjectState } from "@/modules/project";
import { cutAtX } from "./logic/cut";
import { laneDropTarget } from "./logic/drop";
import { CUT_SNAP_PX } from "./timeline.layout";
import type { LaneBox, TimelineApi, TimelineViewState } from "./timeline.types";

export const MIN_PX_PER_SECOND = 2;
export const MAX_PX_PER_SECOND = 400;

/**
 * Creates the timeline view state (zoom and selection) of one kernel. `partners` gives a clip's
 * linked clips, which are selected with it; `lanes` gives the lanes on screen, for drops.
 */
export function createTimelineView(
  partners: (id: ClipId) => ClipId[] = () => [],
  lanes: () => LaneBox[] = () => [],
  project?: () => ProjectState,
): TimelineApi {
  const view = createStore<TimelineViewState>()(() => ({
    pxPerSecond: 60,
    selection: [],
    junctionSelection: [],
    cutPreview: null,
  }));
  return {
    view,
    setZoom(pxPerSecond) {
      const clamped = Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, pxPerSecond));
      view.setState({ pxPerSecond: clamped });
    },
    dropTarget(clientX, clientY) {
      return laneDropTarget(lanes(), clientX, clientY, view.getState().pxPerSecond);
    },
    cutTarget(clientX, clientY) {
      const lane = lanes().find((l) => clientY >= l.top && clientY < l.bottom);
      if (!lane || !project) return null;
      const x = clientX - lane.left;
      return cutAtX(project(), lane.trackId, x, view.getState().pxPerSecond, CUT_SNAP_PX) ?? null;
    },
    previewCut(preview) {
      view.setState({ cutPreview: preview });
    },
    selectJunction(id) {
      view.setState(
        id === null ? { junctionSelection: [] } : { junctionSelection: [id], selection: [] },
      );
    },
    selectClip(id, additive = false) {
      view.setState((s) => {
        if (id === null) return { selection: [], junctionSelection: [] };
        const group = [id, ...partners(id)];
        if (!additive) return { selection: group, junctionSelection: [] };
        return {
          junctionSelection: [],
          selection: s.selection.includes(id)
            ? s.selection.filter((c) => !group.includes(c))
            : [...s.selection, ...group.filter((c) => !s.selection.includes(c))],
        };
      });
    },
  };
}
