import type { InspectorTab, TabState } from "../inspector.types";

/** The tab of a section whose layout names none. */
export const DEFAULT_TAB = "video";

/** The tab a section shows in: the one it names when registered, else the first of the strip. */
export function sectionTab(
  named: string | undefined,
  tabs: readonly InspectorTab[],
): string | undefined {
  const wanted = named ?? DEFAULT_TAB;
  return tabs.some((t) => t.id === wanted) ? wanted : ordered(tabs)[0]?.id;
}

/** The strip for a clip whose sections land in `used`: in order, contextual tabs only when used. */
export function tabStates(tabs: readonly InspectorTab[], used: ReadonlySet<string>): TabState[] {
  return ordered(tabs)
    .map((tab) => ({ tab, available: used.has(tab.id) }))
    .filter(({ tab, available }) => available || tab.contextual !== true);
}

/** The tab to show: the one remembered while it is available, else the first available. */
export function pickTab(
  states: readonly TabState[],
  remembered: string | undefined,
): string | undefined {
  const available = states.filter((s) => s.available);
  return (available.find((s) => s.tab.id === remembered) ?? available[0])?.tab.id;
}

function ordered(tabs: readonly InspectorTab[]): InspectorTab[] {
  return [...tabs].sort((a, b) => a.order - b.order);
}
