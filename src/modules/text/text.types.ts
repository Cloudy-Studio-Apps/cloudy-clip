import type { StoreApi } from "zustand/vanilla";
import type { TextStylePatch } from "@/modules/project";

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

/** What the inspector fields use to edit a text clip. */
export interface TextLive {
  /** Shows `patch` in the preview (merged over what was already input) without touching the project. */
  input(patch: TextStylePatch): void;
  /** Commits the input so far plus `patch` as one `text.setStyle` (skipped when nothing changes), then clears the live override. */
  commit(patch: TextStylePatch): void;
  /** Shows these words in the preview. */
  inputText(text: string): void;
  /** Commits the words as one `text.setText`. Resolves false when nothing changed or they were empty (the field reverts). */
  commitText(text: string): Promise<boolean>;
}
