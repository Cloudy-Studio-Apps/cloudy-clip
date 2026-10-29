/**
 * Text module: text clips drawn over the video, added from the Text tab or by agents.
 * @module text
 */
/** Adds a text clip over the video at the playhead or a given time (optional words, preset, style). */
export { addText } from "./text.add.command";
/** Applies a preset look (title, highlight, outline, pop, lower-third) to text clips. */
export { applyTextPreset } from "./text.preset.command";
/** The text element: its values, panel layout, drawing and timeline look. */
export { textElement } from "./text.element";
/** Lays out words in a style: lines, box and positions from the box center. */
export { textLayout } from "./logic/layout";
/** The preset's style fields for a frame format. */
export { presetStyle, presetTransform } from "./logic/presets";
export type { TextApi, TextPresetId, TextProps, TextStyle } from "./text.types";

/** Module definition, loaded by the app shell. */
export { textModule } from "./text.module";
/** Handle for `require(textRef)` / `useModule(textRef)`. */
export { textRef } from "./text.ref";
