import type { StoreApi } from "zustand/vanilla";
import type { Micros } from "@/core";
import type { MediaAsset, MediaId, MediaKind } from "@/modules/project";

/** Progress of reading a file's metadata. */
export type ProbeStatus = "pending" | "ready" | "error";

/** Where a file is in the native proxy pipeline (mirrors `ProxyState` in Rust). */
export type ProxyState = "analyzing" | "queued" | "encoding" | "ready" | "skipped" | "error";

/**
 * Editing proxy of a file. Pro formats (ProRes, APV, 10-bit HEVC, ...) get a light H.264 copy
 * made by FFmpeg; the preview plays that copy, the original is kept for export.
 */
export interface ProxyInfo {
  state: ProxyState;
  /** 0..1 while encoding. */
  progress?: number;
  /** Why a proxy is made, or what went wrong. */
  message?: string;
  /** Whether the file has a sound stream, from ffprobe; missing when unknown. */
  hasAudio?: boolean;
}

/** Payload of the `media://proxy` event. */
export interface ProxyEvent extends ProxyInfo {
  mediaId: MediaId;
}

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
  /** Proxy pipeline state. Metadata is read only once this is settled. */
  proxy?: ProxyInfo;
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

/** The media module's API for one kernel: file metadata and streaming URLs. */
export interface MediaApi {
  /** Metadata of imported files. Read with `useStore(api.probes, selector)`. */
  readonly probes: StoreApi<MediaProbeState>;
  /** Whether files from the OS are being dragged over the window. */
  readonly fileDrop: StoreApi<{ active: boolean }>;
  /** Current probe of a media item, if any. */
  getProbe(id: MediaId): MediaProbe | undefined;
  /**
   * Resolves when the media has been probed (ready or error), or after `timeoutMs`
   * (default 15 s). Used by agents' tools so they get usable metadata in one call.
   */
  waitForProbe(id: MediaId, timeoutMs?: number): Promise<MediaProbe | undefined>;
  /**
   * URL that streams a registered file from the native loopback media server (with Range
   * support). Changes once a proxy is ready, so media elements reload.
   */
  mediaUrl(id: MediaId): string;
}

/** Probe state plus the setters only the media module uses. */
export interface MediaState extends Omit<MediaApi, "mediaUrl"> {
  /** Sets (or merges into) the probe of one media item. */
  setProbe(id: MediaId, probe: Partial<MediaProbe>): void;
  /** Updates the proxy state of one media item, keeping an earlier explanation. */
  setProxy(id: MediaId, proxy: ProxyInfo): void;
}

/** The native media server connection of one kernel. */
export interface MediaService {
  /** Fetches where the native media server listens. Call once before `mediaUrl`. */
  init(): Promise<void>;
  /** Follows proxy progress from the native side. Resolves to an unlisten function. */
  listenToProxies(): Promise<() => void>;
  /** Streaming URL of a registered file; changes once its proxy is ready. */
  mediaUrl(id: MediaId): string;
}

/** Reads file metadata in the background. */
export interface ProbeQueue {
  /**
   * Adds a file to the queue. Each media id is probed once per kernel, after its proxy
   * pipeline has settled (so pro formats are read from their proxy).
   */
  enqueue(asset: MediaAsset): void;
  /** Drops queued files and ignores results still in flight. */
  dispose(): void;
}
