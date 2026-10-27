import { createStore } from "zustand/vanilla";
import type { ViewportApi, ViewportState } from "./preview.types";

/** Smallest viewer zoom (relative to fit). */
export const MIN_ZOOM = 0.25;
/** Largest viewer zoom (relative to fit). */
export const MAX_ZOOM = 8;

const FITTED: ViewportState = { zoom: 1, panX: 0, panY: 0 };

/**
 * Zooms by `factor` around `anchor` (screen px from the panel's center): the frame point under
 * the anchor stays under it.
 */
export function zoomAround(
  state: ViewportState,
  factor: number,
  anchor: { x: number; y: number },
): ViewportState {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * factor));
  const applied = zoom / state.zoom;
  return {
    zoom,
    panX: anchor.x - (anchor.x - state.panX) * applied,
    panY: anchor.y - (anchor.y - state.panY) * applied,
  };
}

/** Creates the viewer zoom/pan state of one kernel. */
export function createViewport(): ViewportApi {
  const store = createStore<ViewportState>()(() => FITTED);
  return {
    store,
    zoomBy(factor, anchor = { x: 0, y: 0 }) {
      store.setState((s) => zoomAround(s, factor, anchor));
    },
    panBy(dx, dy) {
      store.setState((s) => ({ panX: s.panX + dx, panY: s.panY + dy }));
    },
    fit() {
      store.setState(FITTED);
    },
  };
}
