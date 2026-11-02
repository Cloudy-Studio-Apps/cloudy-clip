import { DEFAULT_SOUND, pitchShift, type ClipSound, type Track } from "@/modules/project";
import type { Slot, SoundGraph } from "./engine.types";

/** Whether a clip needs Web Audio: more than an element's own 0 to 1 volume can do. */
function needsGraph(sound: ClipSound, gain: number): boolean {
  return gain > 1 || sound.pan !== 0 || sound.eq.on || pitchShift(sound) !== 0;
}

/**
 * Sets how an active clip's element sounds. Pictures (video tracks) are silenced with volume,
 * not `muted`: WebKitGTK stops handing a muted <video>'s frames to the canvas (the preview stays
 * black). Sound (audio tracks) follows the track's mute and `gain`: the clip's volume, fades and
 * crossfade under a junction. `silenced` is a muted track above it, around a placement. A clip left
 * at its defaults never enters Web Audio, and plays as a plain element.
 */
export function voiceSlot(
  slot: Slot,
  track: Track,
  gain: number,
  silenced = false,
  sound: ClipSound = DEFAULT_SOUND,
  graph: SoundGraph | null = null,
): void {
  const { element } = slot;
  const audio = track.kind === "audio";
  const off = audio && (track.muted || silenced);
  element.muted = off;
  if (!audio) {
    element.volume = 0;
    return;
  }
  const chain = needsGraph(sound, gain) ? graph?.attach(element) : graph?.chainOf(element);
  if (chain) {
    element.volume = 1;
    chain.apply(sound, off ? 0 : gain);
  } else {
    element.volume = Math.min(1, gain);
  }
}

/**
 * Silences the element of a clip about to start. Pictures stay unmuted (volume 0) for the same
 * WebKitGTK reason, so the right clip of a junction has a drawable frame when the overlap starts.
 */
export function quietSlot(slot: Slot, track: Track, graph: SoundGraph | null = null): void {
  slot.element.muted = track.kind === "audio";
  slot.element.volume = 0;
  graph?.chainOf(slot.element)?.apply(DEFAULT_SOUND, 0);
}
