/**
 * Sound module: the Sound page, and the mix of tracks and master.
 * @module sound
 */
export type { SoundApi } from "./sound.types";

/** Mix commands: a track's volume and pan, the master, and switching between mix A and B. */
export { resetTrackMix, setMaster, setTrackMix, switchMix } from "./sound.mix.commands";

/** Module definition, loaded by the app shell. */
export { soundModule } from "./sound.module";
/** Handle for `require(soundRef)` / `useModule(soundRef)`. */
export { soundRef } from "./sound.ref";
