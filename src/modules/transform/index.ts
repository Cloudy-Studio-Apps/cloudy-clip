/**
 * Transform module: canvas tools to move, scale and rotate clips in the preview.
 * @module transform
 */
/** Puts clips' pictures back to fitted and centered (undoable). */
export { resetTransform } from "./transform.commands";
/** The `transform` shared group (x, y, scale, rotation), edited with `element.setProps`. */
export { transformGroup } from "./transform.group";
export type { TransformApi } from "./transform.types";

/** Module definition, loaded by the app shell. */
export { transformModule } from "./transform.module";
/** Handle for `require(transformRef)` / `useModule(transformRef)`. */
export { transformRef } from "./transform.ref";
