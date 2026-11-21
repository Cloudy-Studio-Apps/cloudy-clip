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
/** Pictures on screen at the playhead, top-most first; clips on a matte track carry `matte: true`. Re-renders only when the list changes. */
export { useVisibleLayers } from "./ui/layers.hook";
/**
 * A screen point as a point in a frame element's output pixels, and the top-most of some placed
 * pictures containing a frame point (an index, -1 if none): a page's own picking in the frame.
 */
export { toFramePoint } from "./logic/frame";
export { topmostAt } from "./logic/picking";
export type { FlipAxis, TransformApi, VisibleLayer } from "./transform.types";

/** Module definition, loaded by the app shell. */
export { transformModule } from "./transform.module";
/** Handle for `require(transformRef)` / `useModule(transformRef)`. */
export { transformRef } from "./transform.ref";
