import type { Micros } from "@/core";
import type { MediaAsset, MediaId, MediaKind } from "@/modules/project";

/** Progress of reading a file's metadata. */
export type ProbeStatus = "pending" | "ready" | "error";

/**
 * Metadata read from a file by the webview. Kept outside the project document (not undoable,
 * re-derivable from the file), keyed by media id.
 */
export interface MediaProbe {
  status: ProbeStatus;
  duration?: Micros;
  /** Picture size, video only. */
  width?: number;
  height?: number;
  /** Object URL of a small poster frame, video only. */
  posterUrl?: string;
  /** Why probing failed (unsupported codec, unreadable file, ...). */
  error?: string;
}

/** State of the probe store. */
export interface MediaProbeState {
  probes: Record<MediaId, MediaProbe>;
}

/** What `media_register` returns per path (mirrors `RegisterOutcome` in Rust). */
export type RegisterOutcome =
  | {
      status: "ok";
      media: { id: string; path: string; name: string; kind: MediaKind; size: number };
    }
  | { status: "error"; path: string; error: { code: string; message: string } };

/** Result of the `media.import` command. */
export interface ImportResult {
  imported: MediaAsset[];
  failed: Array<{ path: string; reason: string }>;
}

/**
 * Detail of the DOM events used to drag media from the library onto other panels.
 * Dragging uses pointer events (not HTML5 drag and drop, which Tauri disables on some
 * platforms when native file drop is enabled).
 */
export interface MediaDragDetail {
  mediaId: MediaId;
  clientX: number;
  clientY: number;
}
