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
/** Formats and frame rates offered in the dialog. */
export { COMPOSITION_PRESETS, FPS_OPTIONS } from "./composition.presets";
export type { CompositionApi, CompositionPreset, CompositionPresetId } from "./composition.types";

/** Module definition, loaded by the app shell. */
export { compositionModule } from "./composition.module";
/** Handle for `require(compositionRef)` / `useModule(compositionRef)`. */
export { compositionRef } from "./composition.ref";
