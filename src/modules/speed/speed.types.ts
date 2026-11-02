import type { StoreApi } from "zustand/vanilla";
import type { Clip, ClipId } from "@/modules/project";

/** What the speed tools remember. Per kernel, and never in history. */
export interface SpeedView {
  /** The clip the speed box is open on. */
  boxClipId: ClipId | null;
  /** The last choice of Ripple timeline. */
  ripple: boolean;
}

/** The speed module's API for one kernel. */
export interface SpeedApi {
  /** Read with `useStore(api.view, selector)`. */
  readonly view: StoreApi<SpeedView>;
}

/** What the speed tools can change on a clip. */
export interface SpeedPatch {
  rate?: number;
  duration?: number;
  pitchCorrection?: boolean;
  reversed?: boolean;
}

/** What one speed command does to each clip it's given. */
export interface SpeedChange {
  rate?: (clip: Clip) => number;
  pitchCorrection?: boolean;
  reversed?: boolean;
  ripple: boolean;
}

/** A clip after a speed change. */
export interface RetimedClip {
  id: ClipId;
  rate: number;
  duration: number;
}
