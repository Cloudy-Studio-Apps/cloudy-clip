import type { ElementApi } from "@/modules/element";
import type { FontRequest } from "@/modules/fonts";
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
  /**
   * Whether a font face can be drawn now; when not, it starts loading and the engine draws text
   * in Inter (the caller redraws when it arrives).
   */
  ensureFont(request: FontRequest): boolean;
  /** The kinds of clip: how each one is drawn and its values. */
  elements: Pick<ElementApi, "get" | "resolve">;
  /** Called when a frame becomes available while paused (e.g. a seek finished). */
  onFrameReady(): void;
}
