import { invoke } from "@tauri-apps/api/core";
import type { MediaId } from "@/modules/project";
import type { RegisterOutcome } from "./media.types";

/** Asks the native side to validate files and allow streaming them. */
export function registerFiles(paths: string[]): Promise<RegisterOutcome[]> {
  return invoke<RegisterOutcome[]>("media_register", { paths });
}

let baseUrl: string | null = null;

/** Fetches where the native media server listens. Called once when the module activates. */
export async function initMediaServer(): Promise<void> {
  baseUrl = await invoke<string>("media_server_url");
}

/**
 * URL that streams a registered file from the native loopback media server (with Range
 * support, so seeking never loads the whole file).
 */
export function mediaUrl(id: MediaId): string {
  if (!baseUrl) throw new Error("The media server is not ready");
  return `${baseUrl}/${encodeURIComponent(id)}`;
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
