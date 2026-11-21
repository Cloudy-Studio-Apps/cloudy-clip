/**
 * Subtitle module: styles of a composition and text clips marked as cues of them, each cue
 * storing its style's values so it reads on its own.
 * @module subtitle
 */
export type { SubtitleApi, SubtitlePreset, SubtitlePresetId } from "./subtitle.types";
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
/** A style's values by path, a cue's own paths, the patch that moves a cue between styles. */
export { ownPaths, restylePatch, styleLeaves } from "./logic/overrides";
/** A preset's text props and position for a frame format, and its name. */
export { PRESET_NAMES, subtitlePreset } from "./logic/presets";
/** Module definition, loaded by the app shell. */
export { subtitleModule } from "./subtitle.module";
/** Handle for `require(subtitleRef)` / `useModule(subtitleRef)`. */
export { subtitleRef } from "./subtitle.ref";
