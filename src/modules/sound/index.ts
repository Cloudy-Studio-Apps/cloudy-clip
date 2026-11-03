/**
 * Sound module: the Sound page with its mixer, and the mix of tracks and master.
 * @module sound
 */
export type { MixTarget, SoundApi, SoundViewState } from "./sound.types";

/** Mix commands: a track's volume and pan, the master, and switching between mix A and B. */
export { resetTrackMix, setMaster, setTrackMix, switchMix } from "./sound.mix.commands";
/** Listening commands: solo a track, and Mono, Dim and the speaker volume. Never undone or exported. */
export { setMonitor, setSolo } from "./sound.monitor.commands";

/** Module definition, loaded by the app shell. */
export { soundModule } from "./sound.module";
/** Handle for `require(soundRef)` / `useModule(soundRef)`; `SOUND_PAGE` is the page's id. */
export { SOUND_PAGE, soundRef } from "./sound.ref";
