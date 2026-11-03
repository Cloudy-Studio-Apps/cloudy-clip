/** The audio module has no API. */
export type AudioApi = Record<string, never>;

/** A part of a clip's sound that resets on its own. */
export type SoundSection = "volume" | "pan" | "fades" | "pitch" | "eq";

/** A value of a clip's sound that can be keyed: the part of `ClipSound` it is, and its range. */
export interface KeyedSound {
  key: "volumeDb" | "pan";
  label: string;
  min: number;
  max: number;
}

/** Which end of a clip a fade sits on. */
export type FadeEdge = "in" | "out";

/** What `startFadeGesture` needs. */
export interface FadeGestureOptions {
  /** The `pointerdown` on the handle. */
  down: PointerEvent;
  edge: FadeEdge;
  /** The fade now, in microseconds. */
  current: number;
  /** The clip's length: a fade stays within it. */
  duration: number;
  pxPerSecond: number;
  /** Shows a fade without writing it (direct DOM). Called again with `current` to put it back. */
  onPreview(fade: number): void;
  /** The release, with a changed fade. */
  onDrop(fade: number): void;
}
