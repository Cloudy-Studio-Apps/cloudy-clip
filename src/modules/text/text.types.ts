import type { StoreApi } from "zustand/vanilla";

/** The colors picked lately, shared by every color field of the text sections. Not in history. */
export interface RecentColors {
  /** Newest first, at most 12. Read with `useStore(recents.store, selector)`. */
  readonly store: StoreApi<{ colors: string[] }>;
  /** Remembers a color (and saves the list). */
  push(color: string): void;
}

/** The text module's API: the recent colors of its inspector sections. Everything else goes through its commands. */
export interface TextApi {
  readonly recents: RecentColors;
}

/** Ready-made looks for a text: `title`, `highlight`, `outline`, `pop` and `lower-third`. */
export type TextPresetId = "title" | "highlight" | "outline" | "pop" | "lower-third";
