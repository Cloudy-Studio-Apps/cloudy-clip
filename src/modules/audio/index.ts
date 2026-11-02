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
