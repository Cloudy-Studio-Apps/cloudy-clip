import type { StoreApi } from "zustand";
import type { Micros } from "@/core";
import type { ClipId, SubtitleStyleId } from "@/modules/project";

/** The subtitle module's API: the Subtitles page's view state. */
export interface SubtitleApi {
  /** What the Subtitles page shows and remembers; never in the project or history. */
  readonly view: StoreApi<SubtitleViewState>;
}

/** The Subtitles page's view state of one kernel. */
export interface SubtitleViewState {
  /** The edge of the selected cue last touched: what Alt+Left / Alt+Right nudge. */
  edge: "start" | "end";
  /** The side panel's tab. */
  tab: "style" | "cue";
  /** The style the Style tab shows, or null for the composition's default. */
  styleId: SubtitleStyleId | null;
  /** A row of the cue list to put the cursor in (at `caret`, the end, or around all its words), once shown. */
  focus: { clipId: ClipId; caret: number | "end" | "all" } | null;
}

/** Which time of a cue the cue list shows and edits: its start, its end, or its length. */
export type CueTimeField = "start" | "end" | "length";

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

/** Cues read from an `.srt` / `.vtt` text, and how many blocks were not cues. */
export interface ParsedSubtitles {
  cues: { start: Micros; end: Micros; text: string }[];
  skipped: number;
}
