/**
 * Keyframe module: keys on a clip's values over time, and the commands that edit them.
 * @module keyframe
 */
/** Adds, removes, moves and changes keys; clears whole tracks. */
export { clearKeys } from "./keyframe.commands";
/** Curves, what happens after the last key, stretching and flipping keys. */
export { scaleKeys, setAfter, setEase } from "./keyframe.ease.commands";
/** Copy keys to your own clipboard and paste them onto clips. */
export { copyKeys, pasteKeys } from "./keyframe.clipboard.commands";
export { moveKeys, removeKeys, setKey, setKeyValues } from "./keyframe.edit.commands";
/** Point: what can be keyed (the element's fields, a module's own). */
export { keyTargets } from "./keyframe.points";
export type {
  CopiedKey,
  CopiedKeys,
  KeyField,
  KeyframeApi,
  KeyframeClipboard,
  KeyframeViewState,
  KeyRef,
  KeyTarget,
} from "./keyframe.types";

/** Module definition, loaded by the app shell. */
export { keyframeModule } from "./keyframe.module";
/** Handle for `require(keyframeRef)` / `useModule(keyframeRef)`. */
export { keyframeRef } from "./keyframe.ref";
