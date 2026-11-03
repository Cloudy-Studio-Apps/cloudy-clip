import {
  DEFAULT_SOUND,
  pitchShift,
  type ClipSound,
  type ClipSpeed,
  type Track,
} from "@/modules/project";
import type { Slot, SoundGraph, Voice } from "./engine.types";

/**
 * A clip's sound with what its speed adds. WebKitGTK always keeps the pitch at any rate (see
 * `docs/superpowers/specs/2026-11-02-speed-preview-check.md`), so a clip without pitch correction
 * gets the shift a plain speed change would give, through the pitch worklet. The result is kept
 * per sound and rate, because the chain only updates when it's handed a new object.
 */
export function createSoundAtSpeed() {
  const known = new WeakMap<ClipSound, Map<number, ClipSound>>();
  return (sound: ClipSound, { rate, pitchCorrection }: ClipSpeed): ClipSound => {
    if (pitchCorrection || rate === 1 || rate === 0) return sound;
    const rates = known.get(sound) ?? new Map<number, ClipSound>();
    known.set(sound, rates);
    const semitones = pitchShift(sound) + 12 * Math.log2(rate);
    const shifted = rates.get(rate) ?? { ...sound, pitch: { on: true, semitones, cents: 0 } };
    rates.set(rate, shifted);
    return shifted;
  };
}

/**
 * Sets how an active clip's element sounds. Pictures (video tracks) are silenced with volume,
 * not `muted`: WebKitGTK stops handing a muted <video>'s frames to the canvas (the preview stays
 * black). Every element of an audio track goes through the graph, into the bus of the track it
 * sounds through, and follows the track's mute and the voice's `gain`: the clip's volume, fades
 * and crossfade under a junction. One that can't enter the graph plays plain, outside the mix.
 */
export function voiceSlot(
  slot: Slot,
  track: Track,
  voice: Voice | null,
  graph: SoundGraph | null = null,
): void {
  const { element } = slot;
  const audio = track.kind === "audio";
  const off = audio && (track.muted || (voice?.silenced ?? false));
  element.muted = off;
  if (!audio || !voice) {
    element.volume = 0;
    return;
  }
  const chain = graph?.attach(element, voice.name);
  if (chain && graph) {
    element.volume = 1;
    chain.routeTo(graph.busOf(voice.bus));
    chain.apply(voice.sound, off ? 0 : voice.gain, voice.pan);
  } else {
    element.volume = Math.min(1, voice.gain);
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
