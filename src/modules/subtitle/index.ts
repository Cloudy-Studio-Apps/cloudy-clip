/**
 * Subtitle module: styles of a composition and text clips marked as cues of them, each cue
 * storing its style's values so it reads on its own.
 * @module subtitle
 */
export type {
  CueTimeField,
  SubtitleApi,
  SubtitlePreset,
  SubtitlePresetId,
  SubtitleViewState,
} from "./subtitle.types";
/** Id of the Subtitles page in `appPages`. */
export { SUBTITLE_PAGE } from "./subtitle.ref";
/** A composition's cues in list order: by start, then track order. */
export { cuesInOrder } from "./logic/srt";
/** Add, change, rename, delete and reorder a composition's subtitle styles. */
export {
  addStyle,
  removeStyle,
  renameStyle,
  reorderStyles,
  updateStyle,
} from "./subtitle.style.commands";
/** Mark text clips as cues of a style, drop the mark, write the style back into a cue. */
export { mark, resetToStyle, unmark } from "./subtitle.mark.commands";
/** Add a cue, cut one in two by its words, merge two neighbours, and read `.srt` / `.vtt` into cues. */
export { addCue, mergeCues, splitCue } from "./subtitle.cue.commands";
export { importSubtitles } from "./subtitle.import.command";
/** Cues from `.srt` / `.vtt` text, `.srt` text of a composition's cues, and the lanes overlapping cues need. */
export { parseSubtitles, toSrt } from "./logic/srt";
export { laneOf } from "./logic/lanes";
/** The file dialogs and native reads and writes for subtitle files. */
export { pickSubtitleFile, readSubtitleFile, saveSrt } from "./subtitle.service";
export type { ParsedSubtitles } from "./subtitle.types";
/** A style's values by path, a cue's own paths, the patch that moves a cue between styles. */
export { ownPaths, restylePatch, styleLeaves } from "./logic/overrides";
/** A preset's text props and position for a frame format, and its name. */
export { PRESET_NAMES, subtitlePreset } from "./logic/presets";
/** Module definition, loaded by the app shell. */
export { subtitleModule } from "./subtitle.module";
/** Handle for `require(subtitleRef)` / `useModule(subtitleRef)`. */
export { subtitleRef } from "./subtitle.ref";
