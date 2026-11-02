import { createStore } from "zustand/vanilla";
import { DEFAULT_EFFORT, DEFAULT_QUALITY } from "./logic/presets";
import type { ExportCapabilities, ExportFormState, ExportQueueState } from "./export.types";

/** Remembers the last folder between sessions. */
const FOLDER_KEY = "cloudy-clip.export.folder";

/** The last folder used, if any. */
export function savedFolder(): string | null {
  return localStorage.getItem(FOLDER_KEY);
}

/** Remembers a folder for the next session. */
export function saveFolder(folder: string): void {
  localStorage.setItem(FOLDER_KEY, folder);
}

/** Creates the queue of one kernel. */
export function createQueueStore() {
  return createStore<ExportQueueState>()(() => ({ jobs: [] }));
}

/** Creates the page's settings of one kernel. */
export function createFormStore() {
  return createStore<ExportFormState>()(() => ({
    name: "",
    folder: "",
    compositionId: null,
    kind: "default",
    quality: DEFAULT_QUALITY,
    format: "h264",
    whole: true,
    from: 0,
    to: 0,
    effort: DEFAULT_EFFORT,
    sound: true,
    hardware: true,
    ifExists: "number",
    reveal: true,
  }));
}

/** Creates what's known about this machine's FFmpeg. */
export function createCapabilitiesStore() {
  return createStore<{ value: ExportCapabilities | null }>()(() => ({ value: null }));
}
