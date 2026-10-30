import type { ProjectState } from "@/modules/project";

/** What project files end in (mirrors `EXTENSION` in Rust). */
export const PROJECT_EXTENSION = "cclip";

/** What a new project is called until it's renamed. */
export const DEFAULT_NAME = "Untitled";

/** Whether nothing was brought into the project, so it isn't worth a file. */
export function isBlank(state: ProjectState): boolean {
  return (
    !state.description && state.mediaOrder.length === 0 && Object.keys(state.clips).length === 0
  );
}

/** Whether the document is what a launch starts with. */
export function isEmpty(state: ProjectState): boolean {
  return state.mediaOrder.length === 0 && state.compositionOrder.length === 0;
}

function lastSeparator(path: string): number {
  return Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
}

/** A project's name: its file name without the extension. */
export function projectName(path: string): string {
  const file = path.slice(lastSeparator(path) + 1);
  const suffix = `.${PROJECT_EXTENSION}`;
  return file.endsWith(suffix) ? file.slice(0, -suffix.length) : file;
}

/** A file next to `path`. */
export function siblingPath(path: string, file: string): string {
  return path.slice(0, lastSeparator(path) + 1) + file;
}

/** `path`, ending in the project extension. */
export function withExtension(path: string): string {
  const suffix = `.${PROJECT_EXTENSION}`;
  return path.endsWith(suffix) ? path : path + suffix;
}

/** Whether a name can be a file name on every platform. */
export function isValidName(name: string): boolean {
  return name.length > 0 && !/[/\\:*?"<>|]/.test(name);
}
