import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  MediaFile,
  MediaService,
  MediaState,
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

/** File extensions accepted by the importer (must match `kind_of` in Rust). */
export const ACCEPTED_EXTENSIONS = [
  "mp4",
  "m4v",
  "mov",
  "webm",
  "mkv",
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "opus",
];
