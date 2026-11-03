import { EDITOR_PAGE, type AppPage, type TimelineScopeName } from "@/core";
import type { Scoped } from "../timeline.types";

/** Whether an entry shows in a scope. An entry without `scopes` shows in `"all"` only. */
export function inScope(entry: Scoped, scope: TimelineScopeName): boolean {
  return (entry.scopes ?? ["all"]).includes(scope);
}

/** The scope of the timeline on the active page: its `timelineScope`, or `"all"`. */
export function activeScope(pages: readonly AppPage[], active: string): TimelineScopeName {
  if (active === EDITOR_PAGE) return "all";
  return pages.find((page) => page.id === active)?.timelineScope ?? "all";
}
