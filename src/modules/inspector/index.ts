/**
 * Inspector module: the right column with details of the project or the selected clips.
 * @module inspector
 */
export type { InspectorApi, InspectorClipSection } from "./inspector.types";

/** Sections of the clip view; contribute with `ctx.contribute(inspectorSections, …)`. */
export { inspectorSections } from "./inspector.points";
/** Module definition, loaded by the app shell. */
export { inspectorModule } from "./inspector.module";
/** Handle for `require(inspectorRef)` / `useModule(inspectorRef)`. */
export { inspectorRef } from "./inspector.ref";
