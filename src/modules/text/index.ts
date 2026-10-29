/**
 * Text module: text clips drawn over the video, added from the Text tab or by agents.
 * @module text
 */
/** Adds a text clip over the video at the playhead or a given time (optional words, preset, style). */
export { addText } from "./text.add.command";
/** Changes the words of a text clip. */
export { setText } from "./text.style.commands";
/** Changes the look of text clips (partial style patch). */
export { setTextStyle } from "./text.style.commands";
/** Applies a preset look (title, highlight, outline, pop, lower-third) to a text clip. */
export { applyTextPreset } from "./text.style.commands";
/** The preset's style fields for a frame format. */
export { presetStyle, presetTransform } from "./logic/presets";
export type { TextApi, TextPresetId } from "./text.types";

/** Module definition, loaded by the app shell. */
export { textModule } from "./text.module";
/** Handle for `require(textRef)` / `useModule(textRef)`. */
export { textRef } from "./text.ref";
