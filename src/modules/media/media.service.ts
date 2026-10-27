import { invoke } from "@tauri-apps/api/core";
import type { MediaId } from "@/modules/project";
import { listen } from "@tauri-apps/api/event";
import type { MediaState, ProxyEvent, RegisterOutcome } from "./media.types";

/** Asks the native side to validate files and allow streaming them. */
export function registerFiles(paths: string[]): Promise<RegisterOutcome[]> {
  return invoke<RegisterOutcome[]>("media_register", { paths });
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
      const version = state.getProbe(id)?.proxy?.state === "ready" ? "?proxy=1" : "";
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
