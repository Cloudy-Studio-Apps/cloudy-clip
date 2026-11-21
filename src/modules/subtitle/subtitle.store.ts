import { createStore } from "zustand/vanilla";
import type { SubtitleViewState } from "./subtitle.types";

/** Creates the Subtitles page's view state of one kernel: the start edge, the Style tab. */
export function createSubtitleView() {
  return createStore<SubtitleViewState>()(() => ({
    edge: "start",
    tab: "style",
    styleId: null,
    focus: null,
  }));
}
