import { createStore } from "zustand/vanilla";
import { pushRecent } from "./logic/recents";
import type { RecentColors } from "./inspector.types";

/** Where the list is saved between sessions. */
export const RECENT_COLORS_KEY = "cloudy-clip.colors.recent";

function load(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c));
  } catch {
    return [];
  }
}

function save(colors: string[]): void {
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(colors));
  } catch {
    // Storage can be blocked; the list then lives for this session only.
  }
}

/** Creates the recent colors of one kernel, read from `localStorage` (failures are ignored). */
export function createRecentColors(): RecentColors {
  const store = createStore<{ colors: string[] }>()(() => ({ colors: load().slice(0, 12) }));
  return {
    store,
    push(color) {
      const colors = pushRecent(store.getState().colors, color);
      store.setState({ colors });
      save(colors);
    },
  };
}
