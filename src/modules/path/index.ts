/**
 * Path module: motion paths drawn on a composition's frame, and picture clips that follow them.
 * @module path
 */
export type { DrawMode, PathApi, PathUiState } from "./path.types";
/** Draw, reshape and delete paths. */
export { createPath, removePaths, updatePath } from "./path.commands";
/** Make clips follow a path, or stop following it where they are. */
export { attachPath, detachPath } from "./path.follow.commands";
/** Module definition, loaded by the app shell. */
export { pathModule } from "./path.module";
/** Handle for `require(pathRef)` / `useModule(pathRef)`. */
export { pathRef } from "./path.ref";
