/**
 * Keyframe module: keys on a clip's values over time, and the commands that edit them.
 * @module keyframe
 */
/** Adds, removes, moves and changes keys; clears whole tracks. */
export { clearKeys } from "./keyframe.commands";
export { moveKeys, removeKeys, setKey, setKeyValues } from "./keyframe.edit.commands";
/** Point: what can be keyed (the element's fields, a module's own). */
export { keyTargets } from "./keyframe.points";
export type { KeyField, KeyframeApi, KeyframeViewState, KeyRef, KeyTarget } from "./keyframe.types";

/** Module definition, loaded by the app shell. */
export { keyframeModule } from "./keyframe.module";
/** Handle for `require(keyframeRef)` / `useModule(keyframeRef)`. */
export { keyframeRef } from "./keyframe.ref";
