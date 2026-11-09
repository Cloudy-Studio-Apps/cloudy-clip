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
/**
 * Drags a fade the way the clip's fade handles do: `onPreview` shows it (direct DOM), `onDrop`
 * gets the changed fade once on release, Escape puts it back. For a page's own fade tool.
 */
export { startFadeGesture } from "./ui/fade.gesture";
/** The fade a drag of `dx` pixels leaves: a fade-in grows right, a fade-out left, within the clip. */
export { draggedFade } from "./logic/fade";
/** What `startFadeGesture` needs, and the edge of a clip a fade is on. */
export type { FadeEdge, FadeGestureOptions } from "./audio.types";
