import type { Track } from "@/modules/project";
import type { Slot } from "./engine.types";

/**
 * Sets how an active clip's element sounds. Pictures (video tracks) are silenced with volume,
 * not `muted`: WebKitGTK stops handing a muted <video>'s frames to the canvas (the preview stays
 * black). Sound (audio tracks) follows the track's mute and `gain`, the clip's crossfade factor
 * under a junction (1 elsewhere). `silenced` is a muted track above it, around a placement.
 */
export function voiceSlot(slot: Slot, track: Track, gain: number, silenced = false): void {
  slot.element.muted = track.kind === "audio" && (track.muted || silenced);
  slot.element.volume = track.kind === "video" ? 0 : gain;
}

/**
 * Silences the element of a clip about to start. Pictures stay unmuted (volume 0) for the same
 * WebKitGTK reason, so the right clip of a junction has a drawable frame when the overlap starts.
 */
export function quietSlot(slot: Slot, track: Track): void {
  slot.element.muted = track.kind === "audio";
  slot.element.volume = 0;
}
