/** The text module's API. Empty: everything it does goes through its commands. */
export type TextApi = Record<string, never>;

/** Ready-made looks for a text: `title`, `highlight`, `outline`, `pop` and `lower-third`. */
export type TextPresetId = "title" | "highlight" | "outline" | "pop" | "lower-third";
