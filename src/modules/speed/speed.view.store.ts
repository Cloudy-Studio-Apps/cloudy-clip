import { createStore } from "zustand/vanilla";
import type { SpeedView } from "./speed.types";

/** The box's clip and the last Ripple choice, per kernel and never in history. */
export function createSpeedView() {
  return createStore<SpeedView>(() => ({ boxClipId: null, ripple: true }));
}
