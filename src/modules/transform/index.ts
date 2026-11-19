/**
 * Transform module: canvas tools to move, scale, stretch, rotate and pivot clips in the preview.
 * @module transform
 */
/** Puts clips' pictures back to fitted and centered (undoable). */
export { resetTransform } from "./transform.commands";
/** Mirrors clips' pictures by negating `scaleX` or `scaleY` and their keys (undoable). */
export { flipTransform } from "./transform.commands";
/** The `composite` shared group (blend mode, opacity), edited with `element.setProps`. */
export { compositeGroup } from "./transform.composite.group";
/** The `transform` shared group (x, y, scale, scaleX, scaleY, rotation, pivotX, pivotY), edited with `element.setProps`. */
export { transformGroup } from "./transform.group";
export type { FlipAxis, TransformApi } from "./transform.types";

/** Module definition, loaded by the app shell. */
export { transformModule } from "./transform.module";
/** Handle for `require(transformRef)` / `useModule(transformRef)`. */
export { transformRef } from "./transform.ref";
