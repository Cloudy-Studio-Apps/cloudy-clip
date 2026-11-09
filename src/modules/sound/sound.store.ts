import { createStore } from "zustand/vanilla";
import { DEFAULT_MONITOR } from "@/modules/preview";
import type { StoreApi } from "zustand";
import type { TrackId } from "@/modules/project";
import type { AutomationMode, SoundViewState } from "./sound.types";

/**
 * Creates the Sound page's view state of one kernel: no track marked, no solo, the default monitor,
 * nothing armed, every track on Read with its clips' lines in front, the Select tool.
 */
export function createSoundView() {
  return createStore<SoundViewState>()(() => ({
    selected: null,
    solo: [],
    expanded: false,
    filter: null,
    monitor: DEFAULT_MONITOR,
    armed: null,
    automation: {},
    lineView: {},
    tool: "select",
    linePoint: null,
  }));
}

/** Sets a track's automation mode (Read, Touch or Latch) in the view. */
export function setAutomationMode(
  view: StoreApi<SoundViewState>,
  trackId: TrackId,
  mode: AutomationMode,
): void {
  view.setState((s) => ({ automation: { ...s.automation, [trackId]: mode } }));
}

/** Puts a track's volume line in front of its clips' lines, or behind them, in the view. */
export function setLineInFront(
  view: StoreApi<SoundViewState>,
  trackId: TrackId,
  inFront: boolean,
): void {
  view.setState((s) => ({ lineView: { ...s.lineView, [trackId]: inFront } }));
}
