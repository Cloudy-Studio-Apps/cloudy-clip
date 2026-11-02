/**
 * Solid module: flat colours in the library and on the timeline.
 * @module solid
 */
export type { SolidApi } from "./solid.types";
export { createSolid, removeSolid, updateSolid } from "./solid.commands";

/** Module definition, loaded by the app shell. */
export { solidModule } from "./solid.module";
/** Handle for `require(solidRef)` / `useModule(solidRef)`. */
export { solidRef } from "./solid.ref";
