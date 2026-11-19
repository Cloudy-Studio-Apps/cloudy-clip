/**
 * Path module: motion paths drawn on a composition's frame, and picture clips that follow them.
 * @module path
 */
export type { DrawMode, PathApi, PathUiState } from "./path.types";
/** Which part of a point a drag moves: the point itself or one of its handles. */
export type { PointPart } from "./path.types";
/** Options of a drag on a path's point or handle (`startPathEdit`). */
export type { PathEditOptions } from "./path.types";
/** Options of a freehand stroke (`startFreehand`). */
export type { FreehandOptions } from "./path.types";
/** Options of one pen click (`startPenPoint`). */
export type { PenOptions } from "./path.types";
/** Starts a drag on a path's point or handle on the canvas; `onDrop` gets the new points on release. */
export { startPathEdit } from "./ui/path.edit.gesture";
/** Draws one freehand stroke; `onDone` gets it in frame space on release. */
export { startFreehand } from "./ui/draw.gesture";
/** Handles one pen click: a corner where it lands, its handles pulled by a drag. */
export { startPenPoint } from "./ui/draw.gesture";
/** Redraws a path overlay on the DOM for given points while a drag runs (no React renders). */
export { paintPath } from "./ui/path.paint";
/** A pointer position as a point in the frame (output px from its center). */
export { framePoint } from "./ui/path.paint";
/** Draw, reshape and delete paths. */
export { createPath, removePaths, updatePath } from "./path.commands";
/** Make clips follow a path, or stop following it where they are. */
export { attachPath, detachPath } from "./path.follow.commands";
/** Module definition, loaded by the app shell. */
export { pathModule } from "./path.module";
/** Handle for `require(pathRef)` / `useModule(pathRef)`. */
export { pathRef } from "./path.ref";
