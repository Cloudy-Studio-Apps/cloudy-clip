import type { StoreApi } from "zustand/vanilla";
import type { ActorId, Micros, PatchableStore } from "@/core";
import type { MediaApi } from "@/modules/media";
import type { MediaAsset, ProjectApi, ProjectState } from "@/modules/project";
import type { PreviewApi } from "@/modules/preview";

/** Where the open project stands. `blank`: nothing on disk yet, and nothing worth writing. */
export type SaveStatus = "blank" | "saved" | "saving" | "failed";

/** The open project. View state: never in the document, never undoable. */
export interface WorkspaceSession {
  /** Its file; null until the first write. */
  path: string | null;
  /** The file's name without the extension. */
  name: string;
  status: SaveStatus;
}

/** What the start dialog shows. */
export type StartView = "hidden" | "home" | "all";

/** The workspace's dialogs. */
export interface WorkspaceUi {
  start: StartView;
  /** Whether the list of missing files is open. */
  relink: boolean;
}

/** A project in the recent list, with what its row shows. */
export interface RecentProject {
  path: string;
  name: string;
  /** When it was last opened or saved, in ms since the epoch. */
  lastUsed: number;
  width: number;
  height: number;
  /** Length of Main. */
  duration: Micros;
  /** What the project is about. */
  description?: string | undefined;
  /** A small picture as a data URL. */
  thumbnail?: string;
}

/** The recent list and which of its files are gone. */
export interface RecentsState {
  items: RecentProject[];
  /** Paths of listed projects whose file is gone. */
  gone: string[];
}

/** The recent list, kept in the app data folder. */
export interface Recents {
  store: StoreApi<RecentsState>;
  load(): Promise<void>;
  /** Adds a project or updates its row, keeping its thumbnail, and moves it to the top. */
  touch(project: Omit<RecentProject, "thumbnail">): void;
  setThumbnail(path: string, thumbnail: string): void;
  rename(from: string, to: string, name: string): void;
  remove(path: string): void;
  /** Looks again at which listed files exist. */
  refresh(): Promise<void>;
}

/** The project file, as written. */
export interface ProjectEnvelope {
  format: string;
  version: number;
  appVersion: string;
  savedAt: string;
  document: ProjectState;
}

/** A saved file, ready to become the document. */
export interface PreparedProject {
  document: ProjectState;
  /** Media still not found. Already marked `missing`. */
  missing: MediaAsset[];
}

/** Writes the document in the background. */
export interface Autosave {
  /** Writes pending changes now. False when the write failed. */
  flush(): Promise<boolean>;
  /** Writes now, even with no changes, even a blank project. False when the write failed. */
  save(): Promise<boolean>;
  /** The document is now this one, and it's on disk (or blank). */
  adopt(state: ProjectState): void;
  dispose(): void;
}

/** What autosave needs. */
export interface AutosaveDeps {
  store: PatchableStore<ProjectState>;
  /** Whether this state is worth a file without being asked. */
  worthWriting(state: ProjectState): boolean;
  write(state: ProjectState): Promise<void>;
  onStatus(status: "saving" | "saved" | "failed", error?: unknown): void;
}

/** What the workspace needs from the rest of the app. */
export interface WorkspaceDeps {
  project: ProjectApi;
  media: MediaApi;
  preview: PreviewApi;
  /** How toasts name an actor. */
  nameOf(actor: ActorId): string;
}

/** The open project and everything done to it. */
export interface WorkspaceCore {
  /** The open project. Read with `useStore(api.session, selector)`. */
  readonly session: StoreApi<WorkspaceSession>;
  readonly ui: StoreApi<WorkspaceUi>;
  readonly recents: Recents;
  /** Writes everything and refreshes the thumbnail. Throws `workspace.save_failed`. */
  leave(): Promise<void>;
  /** Writes now, even a blank project. Throws `workspace.save_failed`. */
  save(): Promise<WorkspaceSession>;
  /** Writes to `path`, and autosave follows it. Throws `workspace.save_failed`. */
  saveAs(path: string): Promise<WorkspaceSession>;
  /** Renames the project and its file. Throws `workspace.bad_name`, `workspace.name_taken`. */
  rename(name: string): Promise<WorkspaceSession>;
  /** Reads a file and finds its media, without changing the open project. */
  prepare(path: string): Promise<PreparedProject>;
  /** Call after replacing the document: a project from `path`, or a new one with `null`. */
  opened(
    path: string | null,
    document: ProjectState,
    missing: readonly MediaAsset[],
    name?: string,
  ): void;
  /** Shows the actor's act to the user when an agent did it. */
  announce(actor: ActorId, did: string): void;
  /** The folder new projects go to. */
  folder(): Promise<string>;
  dispose(): void;
}

/** The workspace module's API for one kernel, with the questions only a person can answer. */
export interface WorkspaceApi extends WorkspaceCore {
  /** Asks the user which file to open, then opens it. Doesn't wait for the answer. */
  askOpen(): void;
  /** Asks the user where to save, then saves. Doesn't wait for the answer. */
  askSaveAs(): void;
}
