import type { ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { Micros, PanelIcon } from "@/core";
import type { BinId, MediaAsset, MediaId, MediaKind } from "@/modules/project";

/** Progress of reading a file's metadata. `missing`: the file isn't where the project says. */
export type ProbeStatus = "pending" | "ready" | "error" | "missing";

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
  /** A video's size, frame rate and length, as soon as ffprobe has read it. */
  meta?: ProbeMeta;
}

/**
 * What ffprobe says about a video, before any proxy exists, or about an animated image, once its
 * frames are ready (mirrors `ProbeMeta` in Rust).
 */
export interface ProbeMeta {
  width: number;
  height: number;
  /** Missing when ffprobe can't tell. */
  fps?: number;
  duration: Micros;
  /** How many frames an animated image has. Only animated images have it. */
  frames?: number;
}

/** What a composition takes from a picture. */
export interface PictureMeta {
  width: number;
  height: number;
  fps: number;
  duration: Micros;
}

/** The frames of an animated image, at a steady rate. */
export interface ImageAnimation {
  frames: number;
  fps: number;
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
  /** Counts how often the item moved to another file, so media elements reload. */
  revision?: number;
}

/** State of the probe store. */
export interface MediaProbeState {
  probes: Record<MediaId, MediaProbe>;
}

/** A file to register, under the id the document knows it by (mirrors `RegisterFile` in Rust). */
export interface RegisterFile {
  id: MediaId;
  path: string;
}

/** What `media_stat` returns (mirrors `MediaFile` in Rust). */
export interface MediaFile {
  name: string;
  kind: MediaKind;
  size: number;
}

/** What `media_register` returns per file (mirrors `RegisterOutcome` in Rust). */
export type RegisterOutcome =
  | {
      status: "ok";
      media: { id: string; path: string; name: string; kind: MediaKind; size: number };
    }
  | { status: "error"; id: string; path: string; error: { code: string; message: string } };

/** What a file says about itself (mirrors `FileFacts` in Rust). */
export interface FileFacts {
  videoCodec?: string;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
  sampleFormat?: string;
  timecode?: string;
  /** ms since the epoch. */
  createdAt?: number;
}

/** A mounted disk (mirrors `DiskInfo` in Rust). */
export interface DiskInfo {
  name: string;
  mountPoint: string;
  totalBytes: number;
  freeBytes: number;
}

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
  item: LibraryItem;
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
   * A picture's size, frame rate (30 when unknown) and length, once known: for a video from ffprobe
   * at the start of import, so it doesn't wait for a proxy. An image's length is the one it lands
   * at. Undefined for audio and for files still being read.
   */
  pictureMeta(id: MediaId): PictureMeta | undefined;
  /**
   * URL that streams a registered file from the native loopback media server (with Range
   * support). Changes once a proxy is ready, so media elements reload.
   */
  mediaUrl(id: MediaId): string;
  /**
   * Makes the full-size copy of a video that previews through a small proxy, reporting 0..1, and
   * resolves to whether it has one. Once done, `masterUrl` streams it. Rejects if it can't be made.
   */
  prepareMaster(id: MediaId, onProgress: (progress: number) => void): Promise<boolean>;
  /** URL of the sharpest picture the webview can decode: the master, otherwise the original. */
  masterUrl(id: MediaId): string;
  /** The frames of an animated image, once they are ready; undefined for anything else. */
  animation(id: MediaId): ImageAnimation | undefined;
  /**
   * URLs of an image's picture `elapsed` after its clip starts, followed by those of the frames up
   * to `ahead` later, looped, each once. A still has the one URL.
   */
  imageFrames(id: MediaId, elapsed: Micros, ahead: Micros): string[];
  /**
   * Prepares the files of a document about to be opened: registers each under its saved id, and
   * marks those that can't be found `missing`. Returns those. Never rejects for a missing file.
   */
  restore(assets: readonly MediaAsset[]): Promise<MediaAsset[]>;
  /** What a file says about itself, read from the original. */
  fileFacts(id: MediaId): Promise<FileFacts>;
  /** What's mounted. */
  listDisks(): Promise<DiskInfo[]>;
  /** Opens the file manager at a file. */
  revealFile(path: string): Promise<void>;
}

/** Probe state plus the setters only the media module uses. */
export interface MediaState extends Omit<
  MediaApi,
  | "mediaUrl"
  | "prepareMaster"
  | "masterUrl"
  | "imageFrames"
  | "restore"
  | "fileFacts"
  | "listDisks"
  | "revealFile"
> {
  /** Sets (or merges into) the probe of one media item. */
  setProbe(id: MediaId, probe: Partial<MediaProbe>): void;
  /** Updates the proxy state of one media item, keeping an earlier explanation. */
  setProxy(id: MediaId, proxy: ProxyInfo): void;
  /** Forgets what was read about a file and starts over from `probe`, with a new revision. */
  replaceProbe(id: MediaId, probe: MediaProbe): void;
}

/** The native media server connection of one kernel. */
export interface MediaService {
  /** Fetches where the native media server listens. Call once before `mediaUrl`. */
  init(): Promise<void>;
  /** Follows proxy progress from the native side. Resolves to an unlisten function. */
  listenToProxies(): Promise<() => void>;
  /** Streaming URL of a registered file; changes once its proxy is ready. */
  mediaUrl(id: MediaId): string;
  /** URL of one frame of an animated image. */
  frameUrl(id: MediaId, index: number): string;
  prepareMaster: MediaApi["prepareMaster"];
  masterUrl: MediaApi["masterUrl"];
}

/** Files of the document, in step with the native side. */
export interface MediaFiles {
  /** Follows the document: probes what comes in, moves what relinks. Returns a stop function. */
  follow(): () => void;
  restore: MediaApi["restore"];
}

/** URL of one frame of an animated image. */
export type MediaFrames = MediaService["frameUrl"];

/** Reads file metadata in the background. */
export interface ProbeQueue {
  /**
   * Adds a file to the queue. Each media id is probed once per kernel, after its proxy
   * pipeline has settled (so pro formats are read from their proxy).
   */
  enqueue(asset: MediaAsset): void;
  /** Allows a media id to be probed again, now that it is another file. */
  forget(id: MediaId): void;
  /** Drops queued files and ignores results still in flight. */
  dispose(): void;
}

/** What is dragged from the Library. */
export type LibraryItem =
  | { type: "media" | "composition"; id: string }
  /** Makes a clip of an element with no file, such as a solid color. */
  | { type: "element"; kind: string; props: Record<string, unknown>; duration?: Micros };

/** One item of a `LibraryKind`. */
export interface LibraryEntry {
  id: string;
  name: string;
  binId?: BinId;
}

/** A kind of item the library lists besides files: its smart bin, tile and create button. */
export interface LibraryKind {
  type: string;
  /** Name of its smart bin, such as "Solid colors". */
  label: string;
  icon: PanelIcon;
  /** A hook: what the library holds of this kind. */
  useEntries(): readonly LibraryEntry[];
  Tile: ComponentType<{ id: string }>;
  CreateButton?: ComponentType;
}

/** A section of the Library, above the files. */
export interface LibrarySection {
  id: string;
  component: ComponentType;
}
