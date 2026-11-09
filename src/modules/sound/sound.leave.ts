import type { StoreApi } from "zustand/vanilla";
import { LOCAL_ACTOR, type PagesState } from "@/core";
import type { CompositionId, ProjectApi } from "@/modules/project";
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

/**
 * Calls `onSwitch` with the newly open composition (or null) each time the user opens another one.
 * Returns what stops following.
 */
export function followCompositionSwitch(
  project: ProjectApi,
  onSwitch: (open: CompositionId | null) => void,
): () => void {
  let open = project.view.openFor(LOCAL_ACTOR);
  return project.view.store.subscribe(() => {
    const next = project.view.openFor(LOCAL_ACTOR);
    if (next === open) return;
    open = next;
    onSwitch(next);
  });
}
