/**
 * Marker module: bookmarks on a composition's timeline, with a note and a color.
 * @module marker
 */
export type { MarkerApi, MarkerUiState } from "./marker.types";
/** Add, edit (time, note, color) and remove markers. */
export { addMarker, removeMarker, updateMarker } from "./marker.commands";
/** Module definition, loaded by the app shell. */
export { markerModule } from "./marker.module";
/** Handle for `require(markerRef)` / `useModule(markerRef)`. */
export { markerRef } from "./marker.ref";
