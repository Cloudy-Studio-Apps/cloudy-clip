import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Text of a project file. */
export function readProject(path: string): Promise<string> {
  return invoke<string>("workspace_read", { path });
}

/** Saves a project file, all at once. */
export function writeProject(path: string, contents: string): Promise<void> {
  return invoke("workspace_write", { path, contents });
}

/** Renames a project file. Rejects rather than overwrite. */
export function renameProject(from: string, to: string): Promise<void> {
  return invoke("workspace_rename", { from, to });
}

/** A free path for a new project in `folder`. */
export function uniquePath(folder: string, stem: string): Promise<string> {
  return invoke<string>("workspace_unique_path", { folder, stem });
}

/** Which of these files exist, in the same order. */
export function existing(paths: readonly string[]): Promise<boolean[]> {
  return invoke<boolean[]>("workspace_exists", { paths });
}

/** The saved recent list; empty when there is none. */
export function readRecents(): Promise<string> {
  return invoke<string>("workspace_recents_read");
}

/** Saves the recent list. */
export function writeRecents(contents: string): Promise<void> {
  return invoke("workspace_recents_write", { contents });
}

/** The app's version, for the project file. */
export function appVersion(): Promise<string> {
  return getVersion();
}

/** Runs `handler` before the window closes. Returning false keeps it open. */
export function onWindowClose(handler: () => Promise<boolean>): Promise<() => void> {
  return getCurrentWindow().onCloseRequested(async (event) => {
    if (!(await handler())) event.preventDefault();
  });
}
