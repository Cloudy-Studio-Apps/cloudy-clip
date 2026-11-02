import { Channel, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type {
  MediaFile,
  MediaService,
  MediaState,
  DiskInfo,
  FileFacts,
  ProxyEvent,
  RegisterFile,
  RegisterOutcome,
} from "./media.types";

/** Asks the native side to validate files and allow streaming them under their ids. */
export function registerFiles(files: RegisterFile[]): Promise<RegisterOutcome[]> {
  return invoke<RegisterOutcome[]>("media_register", { files });
}

/** What a file is, without registering it. Rejects when it is missing or not media. */
export function statFile(path: string): Promise<MediaFile> {
  return invoke<MediaFile>("media_stat", { path });
}

/** What a registered file says about itself. Every field is missing when it can't be told. */
export function readFileFacts(id: string): Promise<FileFacts> {
  return invoke<FileFacts>("media_file_facts", { id });
}

/** What's mounted, without pseudo filesystems. */
export function listDisks(): Promise<DiskInfo[]> {
  return invoke<DiskInfo[]>("media_list_disks");
}

/** Opens the file manager at a file. */
export function revealFile(path: string): Promise<void> {
  return revealItemInDir(path);
}

/** Creates the media server connection, writing proxy progress into `state`. */
export function createMediaService(state: MediaState): MediaService {
  let baseUrl: string | null = null;
  return {
    async init() {
      baseUrl = await invoke<string>("media_server_url");
    },
    listenToProxies() {
      return listen<ProxyEvent>("media://proxy", ({ payload }) => {
        const { mediaId, ...proxy } = payload;
        state.setProxy(mediaId, proxy);
      });
    },
    prepareMaster(id, onProgress) {
      const channel = new Channel<number>();
      channel.onmessage = onProgress;
      return invoke<boolean>("media_prepare_master", { id, onProgress: channel });
    },
    prepareReversed(id, full, onProgress) {
      const channel = new Channel<number>();
      channel.onmessage = onProgress;
      return invoke("media_prepare_reversed", { id, full, onProgress: channel });
    },
    reversedFileUrl(id, full) {
      if (!baseUrl) throw new Error("The media server is not ready");
      const master = full ? "&master=1" : "";
      return `${baseUrl}/${encodeURIComponent(id)}?reversed=1${master}`;
    },
    masterUrl(id) {
      if (!baseUrl) throw new Error("The media server is not ready");
      const revision = state.getProbe(id)?.revision;
      const version = revision ? `&file=${revision}` : "";
      return `${baseUrl}/${encodeURIComponent(id)}?master=1${version}`;
    },
    frameUrl(id, index) {
      if (!baseUrl) throw new Error("The media server is not ready");
      const revision = state.getProbe(id)?.revision;
      const version = revision ? `?file=${revision}` : "";
      return `${baseUrl}/${encodeURIComponent(id)}/frames/${index}${version}`;
    },
    mediaUrl(id) {
      if (!baseUrl) throw new Error("The media server is not ready");
      const probe = state.getProbe(id);
      const query = new URLSearchParams();
      if (probe?.proxy?.state === "ready") query.set("proxy", "1");
      if (probe?.revision) query.set("file", String(probe.revision));
      const version = query.size > 0 ? `?${query}` : "";
      return `${baseUrl}/${encodeURIComponent(id)}${version}`;
    },
  };
}

/** Video file extensions (must match `kind_of` in Rust). */
export const VIDEO_EXTENSIONS = [
  "mp4",
  "m4v",
  "mov",
  "webm",
  "mkv",
  "avi",
  "wmv",
  "asf",
  "mpg",
  "mpeg",
  "m2v",
  "vob",
  "mts",
  "m2ts",
  "ts",
  "mxf",
  "flv",
  "f4v",
  "3gp",
  "3g2",
  "ogv",
  "dv",
];

/** Audio file extensions (must match `kind_of` in Rust). */
export const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "opus",
  "aif",
  "aiff",
  "wma",
  "ac3",
  "eac3",
  "dts",
  "caf",
  "amr",
  "m4b",
  "mka",
  "ape",
  "wv",
  "au",
];

/** Image file extensions (must match `kind_of` in Rust). */
export const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "jfif",
  "webp",
  "bmp",
  "svg",
  "gif",
  "apng",
  "avif",
  "heic",
  "heif",
  "tif",
  "tiff",
  "tga",
  "dds",
  "psd",
  "exr",
  "hdr",
  "dpx",
  "jxl",
];

/** File extensions accepted by the importer. */
export const ACCEPTED_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...IMAGE_EXTENSIONS];
