import type { MediaId } from "@/modules/project";

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
  /** Called when a frame becomes available while paused (e.g. a seek finished). */
  onFrameReady(): void;
}
