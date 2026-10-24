import type { Micros } from "@/core";
import type { ProjectState } from "@/modules/project";

/** Called on every frame while playing, and once per seek while paused. */
export type TimeListener = (time: Micros) => void;

/**
 * The single source of truth for the playhead. Driven by `requestAnimationFrame`, never by
 * React state, so playback causes no re-renders.
 */
export interface PlaybackClock {
  /** Current playhead time. */
  getTime(): Micros;
  isPlaying(): boolean;
  play(): void;
  pause(): void;
  /** Moves the playhead (clamped to `[0, duration]`). */
  seek(time: Micros): void;
  /** Subscribes to time updates. The listener is called immediately with the current time. */
  onTime(listener: TimeListener): () => void;
  /** Subscribes to play/pause changes. Compatible with `useSyncExternalStore`. */
  onPlayingChange(listener: () => void): () => void;
  dispose(): void;
}

/**
 * Renders the timeline at a given time. Swappable: v1 uses HTML media elements and a 2D canvas
 * (`HtmlMediaEngine`); a native or WebCodecs engine can implement the same contract later.
 */
export interface PreviewEngine {
  /** Draws (and, while playing, keeps media in sync with) the project at `time`. */
  render(project: ProjectState, time: Micros, playing: boolean): void;
  /** Stops all media without forgetting state (e.g. on pause). */
  pauseAll(): void;
  /** Whether every visible layer has its frame for the last rendered time. */
  isSettled(): boolean;
  /** The canvas as a base64 PNG (no `data:` prefix). */
  captureFrame(): string;
  dispose(): void;
}
