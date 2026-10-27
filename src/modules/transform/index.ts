/**
 * Transform module: canvas tools to move, scale and rotate clips in the preview.
 * @module transform
 */
/** Moves, scales or rotates a video clip's picture in the frame (undoable). */
export { setClipTransform } from "./transform.commands";
export type { TransformApi } from "./transform.types";

/** Module definition, loaded by the app shell. */
export { transformModule } from "./transform.module";
/** Handle for `require(transformRef)` / `useModule(transformRef)`. */
export { transformRef } from "./transform.ref";
