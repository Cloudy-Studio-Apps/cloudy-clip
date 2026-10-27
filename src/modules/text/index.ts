/**
 * Text module: text clips drawn over the video, added from the Text tab or by agents.
 * @module text
 */
/** Adds a text clip ("Text", default style) over the video at the playhead or a given time. */
export { addText } from "./text.commands";
export type { TextApi } from "./text.types";

/** Module definition, loaded by the app shell. */
export { textModule } from "./text.module";
/** Handle for `require(textRef)` / `useModule(textRef)`. */
export { textRef } from "./text.ref";
