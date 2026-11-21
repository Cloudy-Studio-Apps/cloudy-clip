/** The subtitle module's API. Empty: its commands and tools are its whole surface. */
export type SubtitleApi = Record<string, never>;

/**
 * Ready-made subtitle looks: `classic` (the first style, `Default`), `punchy`, `intense` and
 * `whisper`.
 */
export type SubtitlePresetId = "classic" | "punchy" | "intense" | "whisper";

/** A preset's values for a frame format: text props (whole) and where it sits. */
export interface SubtitlePreset {
  props: Record<string, unknown>;
  position: { x: number; y: number };
}
