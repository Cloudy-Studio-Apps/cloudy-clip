/**
 * Audio module: how a clip sounds, and the inspector's Audio tab.
 * @module audio
 */
export type { AudioApi, SoundSection } from "./audio.types";
export { resetSound, setSound } from "./audio.commands";

/** Module definition, loaded by the app shell. */
export { audioModule } from "./audio.module";
/** Handle for `require(audioRef)` / `useModule(audioRef)`. */
export { audioRef } from "./audio.ref";
/**
 * The equalizer's editor (graph and band rows), value in and callbacks out, as the inspector's
 * Equalizer section draws it.
 */
export { EqEditor } from "./ui";
/** One sound value as the Audio tab draws it: a slider with a reset arrow, changed values in `--mark`. */
export { SoundRow } from "./ui";
