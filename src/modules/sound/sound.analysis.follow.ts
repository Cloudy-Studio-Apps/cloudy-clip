import type { StoreApi } from "zustand/vanilla";
import type { ProjectState } from "@/modules/project";
import type { Analyzer, Matcher } from "./sound.delivery.types";

/**
 * Stops the analyses and Match targets of a composition the project no longer has (another
 * project was opened, or the composition was removed): their FFmpeg would otherwise run to the
 * end for a mix nobody can see. Returns what stops following.
 */
export function followCompositionsGone(
  project: StoreApi<ProjectState>,
  analyzer: Analyzer,
  matcher: Matcher,
): () => void {
  return project.subscribe((state) => {
    const { running, matching } = analyzer.state.getState();
    for (const id of new Set([...Object.keys(running), ...Object.keys(matching)])) {
      if (!state.compositions[id]) void matcher.cancel(id).catch(() => undefined);
    }
  });
}
