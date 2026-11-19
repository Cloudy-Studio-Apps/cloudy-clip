/**
 * Mask module: masks on picture clips (shapes and drawn paths, feathered, combined by mode) and
 * track mattes.
 * @module mask
 */
export type { MaskApi, MaskNumbers, MaskPointInput, MaskPreset, MaskUiState } from "./mask.types";
/** Add masks to picture clips, edit them (keyed values get a key at `at`), delete and reorder them. */
export { addMask, removeMasks, reorderMask, updateMask } from "./mask.commands";
/** Edit a path mask's points (keyed on an animated path), turn a preset mask into points. */
export { convertMask, setPoints } from "./mask.points.commands";
/** Show clips only where another track's picture is, or stop. */
export { setMatte } from "./mask.matte.commands";
/** Module definition, loaded by the app shell. */
export { maskModule } from "./mask.module";
/** Handle for `require(maskRef)` / `useModule(maskRef)`. */
export { maskRef } from "./mask.ref";
