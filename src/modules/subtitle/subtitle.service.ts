import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

const FILTERS = [{ name: "Subtitles", extensions: ["srt", "vtt"] }];

/** Asks the person for an `.srt` or `.vtt` file: its path, or null when they cancel. */
export async function pickSubtitleFile(): Promise<string | null> {
  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  return typeof path === "string" ? path : null;
}

/** Text of an `.srt` or `.vtt` file at an absolute path (at most 8 MB, UTF-8; `subtitle_read_text` natively). */
export function readSubtitleFile(path: string): Promise<string> {
  return invoke<string>("subtitle_read_text", { path });
}

/** Asks where to save `contents` as `.srt` and writes it: the path, or null when they cancel. */
export async function saveSrt(contents: string, suggestedName: string): Promise<string | null> {
  const path = await save({
    defaultPath: suggestedName.endsWith(".srt") ? suggestedName : `${suggestedName}.srt`,
    filters: [{ name: "SubRip", extensions: ["srt"] }],
  });
  if (!path) return null;
  await invoke("subtitle_write_text", { path, contents });
  return path;
}
