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

/** What the preview controller needs from the rest of the app. Injected so it can be tested. */
export interface PreviewControllerDeps {
  clock: PlaybackClock;
  getProject(): ProjectState;
  /** Length of the timeline (cached by the caller; read on every project change). */
  getDuration(): Micros;
  /** Called on every project change. Returns an unsubscribe function. */
  subscribeProject(listener: () => void): () => void;
  /** Called on every media metadata change (e.g. a proxy became ready). */
  subscribeMedia(listener: () => void): () => void;
  createEngine(canvas: HTMLCanvasElement, onFrameReady: () => void): PreviewEngine;
  /** `requestAnimationFrame` in the app; a manual queue in tests. */
  requestFrame(callback: () => void): void;
}

/** The preview module's API for one kernel. */
export interface PreviewApi {
  /** The playhead. The timeline and the preview both follow it. */
  readonly playback: PlaybackClock;
  /** Attaches the preview canvas. Returns a detach function. */
  attachCanvas(canvas: HTMLCanvasElement): () => void;
  /** Redraws on the next frame (e.g. after the canvas was resized). */
  redraw(): void;
  /**
   * Captures the preview as a base64 PNG, optionally at a given time. Waits (up to 3 s) until
   * every visible layer has decoded its frame.
   */
  captureFrame(time?: Micros): Promise<string>;
}

/** The preview controller: its API plus cleanup, owned by the preview module. */
export interface PreviewController extends PreviewApi {
  /** Detaches the canvas, pauses the clock and drops every subscription. */
  dispose(): void;
}
