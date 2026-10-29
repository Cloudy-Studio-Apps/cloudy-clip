import type { Micros } from "@/core";
import type { ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { ClipId, ClipTransform, ProjectState, TextStylePatch } from "@/modules/project";

/** Live words and/or style of a text clip while it is being edited; the style may be partial. */
export interface TextOverride {
  text?: string;
  style?: TextStylePatch;
}

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
  /**
   * Draws (and, while playing, keeps media in sync with) the project at `time`. `transforms`
   * replaces clips' saved transforms while a gesture is in progress.
   */
  render(
    project: ProjectState,
    time: Micros,
    playing: boolean,
    transforms?: ReadonlyMap<ClipId, ClipTransform>,
    textOverrides?: ReadonlyMap<ClipId, TextOverride>,
  ): void;
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
  /**
   * Draws a clip with `transform` instead of its saved one, without changing the project (live
   * feedback while dragging on the canvas). Pass null to go back to the saved transform. The
   * gesture commits with `transform.setClipTransform` on release.
   */
  previewTransform(clipId: ClipId, transform: ClipTransform | null): void;
  /**
   * Draws a text clip with this live `text` and/or `style` (partial) instead of the saved ones,
   * without changing the project (live feedback while editing). Pass null to go back to the saved
   * values. The edit commits with `text.setText` / `text.setStyle`.
   */
  previewTextClip(clipId: ClipId, override: TextOverride | null): void;
  /** Calls `listener` with the clip id whenever a text override is set or cleared. Returns the unsubscribe. */
  onTextOverride(listener: (clipId: ClipId) => void): () => void;
  /** The live override of a text clip, so the canvas tools measure the box being drawn. */
  textClipOverride(clipId: ClipId): TextOverride | undefined;
  /** Zoom and pan of the viewer. View state only: not in the project, not undoable. */
  readonly viewport: ViewportApi;
}

/** Zoom and pan of the preview viewer. */
export interface ViewportState {
  /** Size relative to "fit in the panel": 1 fits, 2 is twice as big. */
  zoom: number;
  /** Offset of the frame from the panel's center, in screen pixels. */
  panX: number;
  panY: number;
}

/** The viewer's zoom and pan, and the ways to change them. */
export interface ViewportApi {
  /** Read with `useStore(viewport.store, selector)` or subscribe imperatively. */
  readonly store: StoreApi<ViewportState>;
  /**
   * Multiplies the zoom by `factor` keeping the point at `anchor` (screen pixels from the
   * panel's center) still. Clamped to `MIN_ZOOM`..`MAX_ZOOM`.
   */
  zoomBy(factor: number, anchor?: { x: number; y: number }): void;
  /** Moves the frame by screen pixels. */
  panBy(dx: number, dy: number): void;
  /** Back to "fit in the panel", centered. */
  fit(): void;
}

/** The preview controller: its API plus cleanup, owned by the preview module. */
export interface PreviewController extends PreviewApi {
  /** Detaches the canvas, pauses the clock and drops every subscription. */
  dispose(): void;
}

/**
 * A layer drawn over the preview frame, such as the canvas tools' selection box. It fills the
 * frame exactly and moves and zooms with it, so it can position things in % of the frame.
 */
export interface PreviewOverlay {
  /** Unique id, `<module>.<name>`. */
  id: string;
  component: ComponentType;
}
