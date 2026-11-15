import { LOCAL_ACTOR } from "@/core";
import type { CompositionId, ProjectApi } from "@/modules/project";

/**
 * Calls `onSwitch` with the newly open composition (or null) each time the user opens another one.
 * Returns what stops following. Leaving the Sound page is core's `followPageLeave`.
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
