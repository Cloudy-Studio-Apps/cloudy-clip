import { createStore } from "zustand/vanilla";
import { DEFAULT_MONITOR } from "@/modules/preview";
import type { SoundViewState } from "./sound.types";

/** Creates the Sound page's view state of one kernel: no track marked, no solo, the default monitor. */
export function createSoundView() {
  return createStore<SoundViewState>()(() => ({
    selectedTrack: null,
    solo: [],
    expanded: false,
    monitor: DEFAULT_MONITOR,
  }));
}
