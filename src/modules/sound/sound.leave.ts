import type { StoreApi } from "zustand/vanilla";
import type { PagesState } from "@/core";
import { SOUND_PAGE } from "./sound.ref";

/**
 * Calls `onLeave` each time the active page stops being the Sound page. Returns what stops
 * following. The Sound page's solo, Mono and Dim show nowhere else, so they mustn't outlive it.
 */
export function followSoundPageLeave(pages: StoreApi<PagesState>, onLeave: () => void): () => void {
  let previous = pages.getState().active;
  return pages.subscribe(({ active }) => {
    if (previous === SOUND_PAGE && active !== SOUND_PAGE) onLeave();
    previous = active;
  });
}
