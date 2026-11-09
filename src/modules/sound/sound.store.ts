import { createStore } from "zustand/vanilla";
import { DEFAULT_MONITOR } from "@/modules/preview";
import type { StoreApi } from "zustand";
import type { CompositionId, TrackId } from "@/modules/project";
import { automationKey } from "./logic/automation";
import type { AutomationMode, LineTarget, SoundViewState } from "./sound.types";

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

/** Sets the automation mode (Read, Touch or Latch) of a track or the master in the view. */
export function setAutomationMode(
  view: StoreApi<SoundViewState>,
  target: LineTarget,
  mode: AutomationMode,
  compositionId: CompositionId | null,
): void {
  const key = automationKey(target, compositionId);
  view.setState((s) => ({ automation: { ...s.automation, [key]: mode } }));
}

/** Puts a track's volume line in front of its clips' lines, or behind them, in the view. */
export function setLineInFront(
  view: StoreApi<SoundViewState>,
  trackId: TrackId,
  inFront: boolean,
): void {
  view.setState((s) => ({ lineView: { ...s.lineView, [trackId]: inFront } }));
}
