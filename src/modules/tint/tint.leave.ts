import type { StoreApi } from "zustand/vanilla";
import type { PagesState } from "@/core";
import { TINT_PAGE } from "./tint.ref";

/**
 * Calls `onLeave` each time the active page stops being the Tint page. Returns what stops
 * following. Bypass and before/after show only in the Tint viewer, so they mustn't outlive it.
 * (Sound's `followSoundPageLeave` is the same shape but private to Sound and fixed to its page.)
 */
export function followTintPageLeave(pages: StoreApi<PagesState>, onLeave: () => void): () => void {
  let previous = pages.getState().active;
  return pages.subscribe(({ active }) => {
    if (previous === TINT_PAGE && active !== TINT_PAGE) onLeave();
    previous = active;
  });
}
