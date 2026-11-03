import { createStore } from "zustand/vanilla";
import type { ActorId } from "@/core";
import type { ClipId, CompositionId, ProjectState } from "@/modules/project";
import { cutAtX } from "./logic/cut";
import { laneDropTarget } from "./logic/drop";
import { pxToTime, timeToPx } from "./logic/geometry";
import { CUT_SNAP_PX, HEADER_WIDTH } from "./timeline.layout";
import type { ClipboardEntry, LaneBox, TimelineApi, TimelineViewState } from "./timeline.types";

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
    headerWidth: HEADER_WIDTH,
    soundUnlinkTold: false,
    tracksHidden: false,
  }));
  let scroller: HTMLElement | null = null;
  const scrollListeners = new Set<() => void>();
  const places = new Map<CompositionId, { pxPerSecond: number; scrollLeft: number }>();
  const copied = new Map<ActorId, ClipboardEntry>();
  const setZoom = (pxPerSecond: number) => {
    const clamped = Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, pxPerSecond));
    view.setState({ pxPerSecond: clamped });
  };
  return {
    view,
    clipboard: {
      get: (actor) => copied.get(actor),
      set: (actor, entry) => void copied.set(actor, entry),
    },
    drop: () => {},
    switchComposition(from, to) {
      if (from !== null) {
        const { pxPerSecond } = view.getState();
        places.set(from, { pxPerSecond, scrollLeft: scroller?.scrollLeft ?? 0 });
      }
      const place = to === null ? undefined : places.get(to);
      view.setState({
        selection: [],
        junctionSelection: [],
        cutPreview: null,
        ...(place && { pxPerSecond: place.pxPerSecond }),
      });
      // After the new timeline has laid out, so its width can hold the old scroll.
      if (!scroller) return;
      requestAnimationFrame(() => {
        if (scroller) scroller.scrollLeft = place?.scrollLeft ?? 0;
      });
    },
    previewClipLength(id, duration) {
      const box = document.querySelector<HTMLElement>(`[data-clip-id="${id}"]`);
      const length = duration ?? project?.().clips[id]?.duration;
      if (box && length !== undefined) {
        box.style.width = `${timeToPx(length, view.getState().pxPerSecond)}px`;
      }
    },
    clipBox(id) {
      const clip = project?.().clips[id];
      const lane = clip && lanes().find((l) => l.trackId === clip.trackId);
      if (!clip || !lane) return null;
      const { pxPerSecond } = view.getState();
      return {
        left: lane.left + timeToPx(clip.start, pxPerSecond),
        right: lane.left + timeToPx(clip.start + clip.duration, pxPerSecond),
        top: lane.top,
        bottom: lane.bottom,
      };
    },
    panelBox() {
      const box = scroller?.getBoundingClientRect();
      return box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom } : null;
    },
    onScroll(listener) {
      scrollListeners.add(listener);
      return () => scrollListeners.delete(listener);
    },
    scrollToTime(time) {
      if (!scroller) return;
      const x = timeToPx(time, view.getState().pxPerSecond);
      if (x < scroller.scrollLeft || x > scroller.scrollLeft + scroller.clientWidth - 200) {
        scroller.scrollLeft = Math.max(0, x - 40);
      }
    },
    attachScroller(element) {
      scroller = element;
      const notify = () => scrollListeners.forEach((listener) => listener());
      element.addEventListener("scroll", notify, { passive: true });
      return () => {
        element.removeEventListener("scroll", notify);
        if (scroller === element) scroller = null;
      };
    },
    setZoom,
    setHeaderWidth(px) {
      const width = px ?? HEADER_WIDTH;
      if (view.getState().headerWidth !== width) view.setState({ headerWidth: width });
    },
    setTracksHidden(hidden) {
      if (view.getState().tracksHidden !== hidden) view.setState({ tracksHidden: hidden });
    },
    scrollLeft: () => scroller?.scrollLeft ?? 0,
    setScrollLeft(px) {
      if (scroller) scroller.scrollLeft = Math.max(0, px);
    },
    zoomAt(clientX, pxPerSecond) {
      if (!scroller) {
        setZoom(pxPerSecond);
        return;
      }
      const { pxPerSecond: before, headerWidth } = view.getState();
      const pointerX = clientX - scroller.getBoundingClientRect().left - headerWidth;
      const anchor = pxToTime(scroller.scrollLeft + pointerX, before);
      setZoom(pxPerSecond);
      const after = view.getState().pxPerSecond;
      scroller.scrollLeft = Math.max(0, timeToPx(anchor, after) - pointerX);
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
