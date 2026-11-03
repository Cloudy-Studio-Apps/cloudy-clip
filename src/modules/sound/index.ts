/**
 * Sound module: the Sound page with its mixer, and the mix of tracks and master.
 * @module sound
 */
export type {
  EffectSpec,
  MixTarget,
  Recorder,
  RecorderState,
  SoundPreset,
  SoundApi,
  SoundViewState,
  UserPresets,
} from "./sound.types";

/** Mix commands: a track's volume and pan, the master, and switching between mix A and B. */
export { resetTrackMix, setMaster, setTrackMix, switchMix } from "./sound.mix.commands";
/** Effect chains: add, change, remove and move an effect on a track or the master, and apply a preset. */
export {
  addEffect,
  applyPreset,
  moveEffect,
  removeEffect,
  setEffect,
} from "./sound.effects.commands";
/**
 * The user's own presets: keep a chain as one, rename it, remove it. Not undoable and no MCP tools:
 * they belong to the user, outside any project.
 */
export { removePreset, renamePreset, savePreset } from "./sound.presets.commands";
/** The presets that come with the app. */
export { BUILT_IN_PRESETS } from "./logic/presets";
/**
 * Listening commands: solo a track; Mono, Dim and the speaker volume; and clearing solo, Mono and
 * Dim (run when the Sound page closes). Never undone or exported.
 */
export { clearListening, setMonitor, setSolo } from "./sound.monitor.commands";

/**
 * Places a recorded take: imports the file and puts it on an audio track, one undo step. Recording
 * itself is the recorder's (`SoundApi.recorder`), with no command or tool: the microphone is the user's.
 */
export { placeRecording } from "./sound.record.commands";

/** Module definition, loaded by the app shell. */
export { soundModule } from "./sound.module";
/** Handle for `require(soundRef)` / `useModule(soundRef)`; `SOUND_PAGE` is the page's id. */
export { SOUND_PAGE, soundRef } from "./sound.ref";
