import { createStore } from "zustand/vanilla";
import { MAX_RECENT_STICKERS, pushRecent } from "./logic/recents";
import type { StickerRecent, StickerRecents } from "./sticker.types";

/** Where the list is saved between sessions. */
export const RECENT_STICKERS_KEY = "cloudy-clip.stickers.recent";

function isRecent(value: unknown): value is StickerRecent {
  if (typeof value !== "object" || value === null) return false;
  const { pack, sticker } = value as Partial<StickerRecent>;
  return typeof pack === "string" && typeof sticker === "string";
}

function load(): StickerRecent[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_STICKERS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isRecent).slice(0, MAX_RECENT_STICKERS) : [];
  } catch {
    return [];
  }
}

function save(recents: StickerRecent[]): void {
  try {
    localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(recents));
  } catch {
    // Storage can be blocked; the list then lives for this session only.
  }
}

/** Creates the recent stickers of one kernel, read from `localStorage` (failures are ignored). */
export function createStickerRecents(): StickerRecents {
  const store = createStore<{ recents: StickerRecent[] }>()(() => ({ recents: load() }));
  return {
    store,
    push(recent) {
      const recents = pushRecent(store.getState().recents, recent);
      store.setState({ recents });
      save(recents);
    },
  };
}
