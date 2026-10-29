import type { ElementApi } from "@/modules/element";
import type { FontRequest } from "@/modules/fonts";
import type { JunctionApi } from "@/modules/junction";
import type { Micros } from "@/core";
import type { Clip, MediaId, ProjectState, Track } from "@/modules/project";

/** One pooled media element and what it is currently showing. */
export interface Slot {
  element: HTMLMediaElement;
  kind: "video" | "audio";
  mediaId: MediaId | null;
  /** URL currently loaded. Changes when a file gets its proxy, which forces a reload. */
  url: string | null;
  clipId: string | null;
  /** Target of the seek in flight, to avoid re-issuing it every frame. */
  seekTarget: number | null;
  /** `performance.now()` of the last seek. */
  lastSeekAt: number;
  /**
   * Whether the frame for the current position has actually been decoded. WebKit fires
   * `seeked` before that, so drawing at `seeked` can paint black.
   */
  presented: boolean;
}

/** What the HTML engine needs from the app. */
export interface EngineOptions {
  /** URL that streams a media item. */
  mediaUrl(id: MediaId): string;
  /**
   * Whether a font face can be drawn now; when not, it starts loading and the engine draws text
   * in Inter (the caller redraws when it arrives).
   */
  ensureFont(request: FontRequest): boolean;
  /** The kinds of clip: how each one is drawn and its values. */
  elements: Pick<ElementApi, "get" | "resolve">;
  /** The kinds of junction: how two overlapping clips of a track are mixed, and their values. */
  junctions: Pick<JunctionApi, "get" | "resolve">;
  /** Called when a frame becomes available while paused (e.g. a seek finished). */
  onFrameReady(): void;
}

/** A track's clips under the playhead, in start order (two during a junction's overlap). */
export interface ActiveTrack {
  track: Track;
  clips: Clip[];
}

/** One video track to draw at `time`. */
export interface TrackFrame extends ActiveTrack {
  project: ProjectState;
  time: Micros;
}

/** Draws one clip onto `target` at its placement (a media frame or the element's own `draw`). */
export type ClipDrawer = (target: CanvasRenderingContext2D, clip: Clip) => void;
