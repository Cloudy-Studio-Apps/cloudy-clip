import { documentDir, join } from "@tauri-apps/api/path";
import { CommandFailure, createLogger, LOCAL_ACTOR, notify } from "@/core";
import { createStore } from "zustand/vanilla";
import type { Composition, ProjectState } from "@/modules/project";
import { decodeProject, encodeProject } from "./logic/format";
import {
  DEFAULT_NAME,
  isBlank,
  isEmpty,
  isValidName,
  PROJECT_EXTENSION,
  projectName,
  siblingPath,
  withExtension,
} from "./logic/names";
import { createAutosave } from "./workspace.autosave";
import { createRecents } from "./workspace.recents";
import {
  appVersion,
  existing,
  readProject,
  renameProject,
  uniquePath,
  writeProject,
} from "./workspace.service";
import { shrinkFrame } from "./workspace.thumbnail";
import type {
  LeaveTask,
  PreparedProject,
  WorkspaceCore,
  WorkspaceDeps,
  WorkspaceSession,
  WorkspaceUi,
} from "./workspace.types";

const log = createLogger("workspace");

const PROJECTS_FOLDER = "Cloudy Clip";
/** Where the thumbnail is taken from, at most: past any fade in. */
const THUMBNAIL_TIME = 1_000_000;

/** The file's own name: the library's can be another. */
const fileNameOf = (path: string) => path.split(/[\\/]/).pop() ?? path;

function mainOf(state: ProjectState): Composition | undefined {
  return state.mainCompositionId === null ? undefined : state.compositions[state.mainCompositionId];
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return (error as { message?: string } | null)?.message ?? String(error);
}

/** The open project: where it lives, saving it, and what opening another takes. */
export function createWorkspace({ project, media, preview, nameOf }: WorkspaceDeps): WorkspaceCore {
  const session = createStore<WorkspaceSession>(() => ({
    path: null,
    name: DEFAULT_NAME,
    status: "blank",
  }));
  const ui = createStore<WorkspaceUi>(() => ({ start: "home", relink: false }));
  const recents = createRecents();
  const folder = async () => join(await documentDir(), PROJECTS_FOLDER);

  function remember(path: string, state: ProjectState): void {
    const main = mainOf(state);
    recents.touch({
      path,
      name: projectName(path),
      lastUsed: Date.now(),
      width: main?.format.width ?? 0,
      height: main?.format.height ?? 0,
      duration: main?.duration ?? 0,
      description: state.description,
    });
  }

  async function write(state: ProjectState): Promise<void> {
    const { path, name } = session.getState();
    const target = path ?? (await uniquePath(await folder(), name));
    await writeProject(target, encodeProject(state, await appVersion(), new Date()));
    session.setState({ path: target, name: projectName(target) });
    remember(target, state);
  }

  const autosave = createAutosave({
    store: project.store,
    worthWriting: (state) => session.getState().path !== null || !isBlank(state),
    write,
    onStatus(status, error) {
      if (status === "failed" && session.getState().status !== "failed") {
        log.warn("Could not save", error);
        notify("error", `Your project could not be saved: ${messageOf(error)}`);
      }
      session.setState({ status });
    },
  });

  // An agent starting on an empty project shouldn't stay hidden behind the dialog.
  const stopWatching = project.store.subscribe((next, previous) => {
    if (ui.getState().start !== "hidden" && isEmpty(previous) && !isEmpty(next)) {
      ui.setState({ start: "hidden" });
    }
  });

  async function refreshThumbnail(): Promise<void> {
    const { path } = session.getState();
    const state = project.store.getState();
    const main = mainOf(state);
    if (path === null || !main) return;
    try {
      const time = Math.min(THUMBNAIL_TIME, Math.floor(main.duration / 10));
      recents.setThumbnail(path, await shrinkFrame(await preview.captureAt(time, main.id)));
    } catch (error) {
      log.warn("No thumbnail this time", error);
    }
  }

  const leaving = new Set<LeaveTask>();

  const saveFailed = () =>
    new CommandFailure("workspace.save_failed", "The project could not be saved.");

  return {
    session,
    ui,
    recents,
    async leave() {
      for (const task of leaving) {
        const held = task.blocking();
        if (held) throw new CommandFailure(held.code, held.message);
      }
      if (!(await autosave.flush())) throw saveFailed();
      await refreshThumbnail();
    },
    async prepareLeave() {
      for (const task of [...leaving]) {
        await task
          .finish()
          .catch((error: unknown) => log.warn("A task before leaving failed", error));
      }
    },
    beforeLeave(task) {
      leaving.add(task);
      return () => void leaving.delete(task);
    },
    async save() {
      if (!(await autosave.save())) throw saveFailed();
      await refreshThumbnail();
      return session.getState();
    },
    async saveAs(path) {
      const before = session.getState();
      session.setState({ path: withExtension(path), name: projectName(path) });
      if (await autosave.save()) return session.getState();
      session.setState({ path: before.path, name: before.name });
      throw saveFailed();
    },
    async rename(raw) {
      const name = raw.trim();
      if (!isValidName(name)) {
        throw new CommandFailure("workspace.bad_name", "A name can't use / \\ : * ? \" < > |");
      }
      const { path } = session.getState();
      if (path === null) {
        session.setState({ name });
        return session.getState();
      }
      if (!(await autosave.flush())) throw saveFailed();
      const target = siblingPath(path, `${name}.${PROJECT_EXTENSION}`);
      if (target === path) return session.getState();
      const [taken] = await existing([target]);
      if (taken) {
        throw new CommandFailure("workspace.name_taken", `There's already a project "${name}".`);
      }
      await renameProject(path, target);
      session.setState({ path: target, name });
      recents.rename(path, target, name);
      return session.getState();
    },
    async prepare(path): Promise<PreparedProject> {
      const text = await readProject(path).catch((error: unknown) => {
        const missing = (error as { code?: string } | null)?.code === "not_found";
        throw new CommandFailure(
          missing ? "workspace.not_found" : "workspace.read_failed",
          messageOf(error),
        );
      });
      const document = decodeProject(text);
      const assets = Object.values(document.media);

      // A folder moved as a whole: the files sit next to the project.
      const found = await existing(assets.map((asset) => asset.path));
      const lost = assets.filter((_, index) => !found[index]);
      const nearby = lost.map((asset) => siblingPath(path, fileNameOf(asset.path)));
      const here = await existing(nearby);
      lost.forEach((asset, index) => {
        if (here[index]) asset.path = nearby[index]!;
      });

      return { document, missing: await media.restore(assets) };
    },
    opened(path, document, missing, name) {
      preview.playback.pause();
      autosave.adopt(document);
      session.setState({
        path,
        name: path === null ? (name ?? DEFAULT_NAME) : projectName(path),
        status: path === null ? "blank" : "saved",
      });
      if (path !== null) remember(path, document);
      ui.setState({ start: "hidden", relink: missing.length > 0 });
    },
    announce(actor, did) {
      if (actor !== LOCAL_ACTOR) notify("info", `${nameOf(actor)} ${did}`);
    },
    folder,
    dispose() {
      stopWatching();
      autosave.dispose();
    },
  };
}
