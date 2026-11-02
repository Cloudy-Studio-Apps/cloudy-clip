import { invoke } from "@tauri-apps/api/core";
import { join, videoDir } from "@tauri-apps/api/path";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { ExportCapabilities, ExportSpec } from "./export.types";

/** What the FFmpeg on this machine can write. */
export function readCapabilities(): Promise<ExportCapabilities> {
  return invoke<ExportCapabilities>("export_capabilities");
}

/** Starts FFmpeg. Frames go to `frameUrl`, then `finishExport` waits for the file. */
export function beginExport(spec: ExportSpec): Promise<{ jobId: string; frameUrl: string }> {
  return invoke("export_begin", { spec });
}

/** Hands one frame to FFmpeg. Resolves once it took it, which paces the drawing. */
export async function sendFrame(frameUrl: string, pixels: Uint8ClampedArray): Promise<void> {
  const response = await fetch(frameUrl, { method: "POST", body: pixels as BodyInit });
  if (!response.ok) throw new Error(await response.text());
}

/** Waits for FFmpeg and returns the path of the file. Rejects with what FFmpeg said. */
export function finishExport(jobId: string): Promise<string> {
  return invoke("export_finish", { jobId });
}

/** Stops FFmpeg and removes what it wrote. */
export function cancelExport(jobId: string): Promise<void> {
  return invoke("export_cancel", { jobId });
}

/** Id of the clip that measures how video is drawn; `masterUrl` streams it. */
export function levelsClip(): Promise<string> {
  return invoke("export_levels_clip");
}

/** Bytes free on the disk of a folder. */
export function freeSpace(folder: string): Promise<number> {
  return invoke("export_free_space", { folder });
}

/** A path nothing is at: the one given, or it with a number. */
export function uniquePath(path: string): Promise<string> {
  return invoke("export_unique_path", { path });
}

/** Where exports go until the user picks a folder. */
export async function defaultFolder(): Promise<string> {
  return join(await videoDir(), "Cloudy Clip");
}

/** Lets the user pick a folder. Null if they cancel. */
export function pickFolder(current: string): Promise<string | null> {
  return open({ directory: true, multiple: false, defaultPath: current });
}

/** Asks whether a file may be replaced. */
export function confirmReplace(file: string): Promise<boolean> {
  return ask(`"${file}" already exists. Replace it?`, { title: "Export", kind: "warning" });
}

/** Shows a file in the system's file manager. */
export function revealFile(path: string): Promise<void> {
  return revealItemInDir(path);
}
