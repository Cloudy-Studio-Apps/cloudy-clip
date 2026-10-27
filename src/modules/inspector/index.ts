/**
 * Inspector module: the right column with details of the project or the selected clips.
 * @module inspector
 */
export type { InspectorApi } from "./inspector.types";

/** Module definition, loaded by the app shell. */
export { inspectorModule } from "./inspector.module";
/** Handle for `require(inspectorRef)` / `useModule(inspectorRef)`. */
export { inspectorRef } from "./inspector.ref";
