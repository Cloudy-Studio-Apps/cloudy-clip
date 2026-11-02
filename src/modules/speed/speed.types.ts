import type { StoreApi } from "zustand/vanilla";
import type { ClipId } from "@/modules/project";

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

/** A clip after a speed change. */
export interface RetimedClip {
  id: ClipId;
  rate: number;
  duration: number;
}
