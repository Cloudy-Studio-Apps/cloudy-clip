import type { Clip, ProjectState } from "@/modules/project";
import type { FilterGate } from "../preview.types";

/**
 * Whether every visible clip that paints itself has its picture ready. Every clip is asked, even
 * after one says no, because asking is what starts its loading.
 */
export function picturesSettled(
  items: readonly { clip: Clip; hidden: boolean }[],
  readyOf: (clip: Clip) => boolean,
): boolean {
  let settled = true;
  for (const { clip, hidden } of items) {
    if (!hidden && !readyOf(clip)) settled = false;
  }
  return settled;
}

/**
 * Whether every filter that applies to `subject` is ready. Every one is asked, even after one says
 * no, because asking is what starts its loading.
 */
export function filtersReady<S>(
  filters: readonly FilterGate<S>[],
  subject: S,
  project: ProjectState,
): boolean {
  let ready = true;
  for (const filter of filters) {
    if (filter.ready && filter.applies(subject, project) && !filter.ready(subject, project)) {
      ready = false;
    }
  }
  return ready;
}
