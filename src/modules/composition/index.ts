/**
 * Composition module: what a timeline is. Its settings, the commands that create and set up
 * compositions, and placing one inside another. The data lives in `project`.
 * @module composition
 */
/** Commands on whole compositions. */
export {
  closeTab,
  createComposition,
  createFromMedia,
  deleteComposition,
  duplicateComposition,
  extendToFitOnce,
  openComposition,
  setMain,
  setSettings,
} from "./composition.commands";
/** Places a composition on a timeline, as a live mirror. */
export { placeComposition } from "./composition.place.command";
/** Gives a placement its own copy; puts clips into a new composition. */
export { makeUnique } from "./composition.unique.command";
export { groupClips } from "./composition.group.command";
/** Formats and frame rates offered in the dialog. */
export { COMPOSITION_PRESETS, FPS_OPTIONS } from "./composition.presets";
export type { CompositionApi, CompositionPreset, CompositionPresetId } from "./composition.types";

/** Module definition, loaded by the app shell. */
export { compositionModule } from "./composition.module";
/** Handle for `require(compositionRef)` / `useModule(compositionRef)`. */
export { compositionRef } from "./composition.ref";
