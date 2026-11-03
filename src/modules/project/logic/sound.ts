import type { Micros } from "@/core";
import type { Clip, ClipSound, EqBand } from "../project.types";

const bell = (hz: number): EqBand => ({ on: true, shape: "bell", hz, db: 0, q: 1 });

/** How a clip sounds until it's changed: as the file does. */
export const DEFAULT_SOUND: ClipSound = {
  volumeDb: 0,
  pan: 0,
  fadeIn: 0,
  fadeOut: 0,
  pitch: { on: false, semitones: 0, cents: 0 },
  eq: {
    on: false,
    bands: [
      { on: true, shape: "lowCut", hz: 50, db: 0, q: 1 },
      { on: true, shape: "lowShelf", hz: 120, db: 0, q: 1 },
      bell(500),
      bell(1200),
      bell(3500),
      { on: true, shape: "highCut", hz: 16000, db: 0, q: 1 },
    ],
  },
};

/**
 * A clip's sound; the defaults when it has none of its own. A stored sound is whole, but the one
 * of an animated clip (`animatedClip`) may hold only its keyed values, so the rest fills in.
 */
export function soundOf(clip: Pick<Clip, "sound">): ClipSound {
  const { sound } = clip;
  if (!sound) return DEFAULT_SOUND;
  return sound.eq ? sound : { ...DEFAULT_SOUND, ...sound };
}

/**
 * `value`, or undefined when it equals `defaults` (deep equality), so defaults are never stored.
 */
export function minimize<T>(value: T, defaults: T): T | undefined {
  return JSON.stringify(value) === JSON.stringify(defaults) ? undefined : value;
}

/** Decibels as a factor. */
export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

/** Whether pitch changes anything, with the shift in semitones. */
export function pitchShift({ pitch }: ClipSound): number {
  return pitch.on ? pitch.semitones + pitch.cents / 100 : 0;
}

/** Whether a band changes the sound. */
export function bandActive(band: EqBand): boolean {
  return band.on && (band.shape === "lowCut" || band.shape === "highCut" || band.db !== 0);
}

/** The level of an equal-power fade, `share` of the way through (FFmpeg's `qsin`). */
function fadeCurve(share: number): number {
  return Math.sin((Math.min(1, Math.max(0, share)) * Math.PI) / 2);
}

/** The level a clip's own fades leave at a time on its timeline. */
export function fadeLevel(sound: ClipSound, clip: Pick<Clip, "start" | "duration">, time: Micros) {
  const since = time - clip.start;
  const left = clip.start + clip.duration - time;
  const fadeIn = sound.fadeIn > 0 ? fadeCurve(since / sound.fadeIn) : 1;
  const fadeOut = sound.fadeOut > 0 ? fadeCurve(left / sound.fadeOut) : 1;
  return Math.min(fadeIn, fadeOut);
}
