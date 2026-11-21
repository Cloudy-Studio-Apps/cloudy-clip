/**
 * Text module: text clips drawn over the video, added from the Text tab or by agents.
 * @module text
 */
/** Applies a preset look (title, highlight, outline, pop, lower-third) to text clips. */
export { applyTextPreset } from "./text.preset.command";
/** The text element: its values, panel layout, drawing and timeline look. */
export { textElement } from "./text.element";
/** Whether a clip is a text clip. */
export { isTextClip } from "./text.guards";
/**
 * The style as a text clip would store it: faces snapped to the family, colors as the patch schema
 * writes them.
 */
export { normalizeTextStyle } from "./text.guards";
/** The default style for a frame format, and the style a text clip is drawn with. */
export { defaultTextStyle, textStyleOf } from "./logic/layout";
/** Lays out words in a style: lines, box and positions from the box center. */
export { textLayout } from "./logic/layout";
/** The preset's style fields for a frame format. */
export { presetStyle, presetTransform } from "./logic/presets";
export type { TextApi, TextPresetId, TextProps, TextStyle } from "./text.types";

/** Module definition, loaded by the app shell. */
export { textModule } from "./text.module";
/** Handle for `require(textRef)` / `useModule(textRef)`. */
export { textRef } from "./text.ref";
