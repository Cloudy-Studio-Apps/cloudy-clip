import { createStore } from "zustand/vanilla";
import type { PictureControl, PictureOptions, PictureViewState } from "./preview.types";

/**
 * The live preview's picture state of one kernel: bypass, compare and the viewer's passes, the
 * listeners told after each live draw, and frame reads from `canvas()` (the canvas drawn on now).
 */
export function createPicture(canvas: () => HTMLCanvasElement | null): PictureControl {
  const view = createStore<PictureViewState>()(() => ({
    bypass: false,
    compare: null,
    viewer: {},
  }));
  const listeners = new Set<() => void>();
  let options: PictureOptions | null = null;
  let seen: PictureViewState | null = null;
  /** The small canvas frames are read on: CPU-backed for `getImageData`, never the live one. */
  let reader: CanvasRenderingContext2D | null = null;

  return {
    view,
    setBypass(on) {
      if (view.getState().bypass !== on) view.setState({ bypass: on });
    },
    setCompare(wipe) {
      const compare = wipe === null ? null : Math.min(1, Math.max(0, wipe));
      if (view.getState().compare !== compare) view.setState({ compare });
    },
    setViewerPasses(id, passes) {
      const viewer = { ...view.getState().viewer };
      if (passes) viewer[id] = passes;
      else if (id in viewer) delete viewer[id];
      else return;
      view.setState({ viewer });
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    readFrame(maxWidth) {
      const live = canvas();
      if (!live || live.width === 0 || live.height === 0) return null;
      const width = Math.max(1, Math.min(live.width, Math.round(maxWidth)));
      const height = Math.max(1, Math.round((live.height * width) / live.width));
      reader ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
      if (!reader) return null;
      if (reader.canvas.width !== width) reader.canvas.width = width;
      if (reader.canvas.height !== height) reader.canvas.height = height;
      reader.drawImage(live, 0, 0, width, height);
      return reader.getImageData(0, 0, width, height);
    },
    options() {
      const state = view.getState();
      if (state !== seen || !options) {
        seen = state;
        const viewer = Object.entries(state.viewer).map(([id, passes]) => ({ id, passes }));
        options = { bypass: state.bypass, compare: state.compare, viewer, only: null };
      }
      return options;
    },
    drawn() {
      listeners.forEach((listener) => listener());
    },
  };
}
