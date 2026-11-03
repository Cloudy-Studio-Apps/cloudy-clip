/**
 * Workspace module: which project is open and where it lives. The start dialog, saving and
 * autosave, opening, renaming and the recent list. The document itself lives in `project`.
 * @module workspace
 */
/** Commands on the project as a whole. */
export {
  listRecent,
  newProject,
  openProject,
  renameProject,
  saveProject,
  saveProjectAs,
  setDescription,
  showStart,
} from "./workspace.commands";
export type {
  LeaveRun,
  LeaveTask,
  RecentProject,
  SaveStatus,
  StartView,
  WorkspaceApi,
  WorkspaceSession,
} from "./workspace.types";

/** Module definition, loaded by the app shell. */
export { workspaceModule } from "./workspace.module";
/** Handle for `require(workspaceRef)` / `useModule(workspaceRef)`. */
export { workspaceRef } from "./workspace.ref";
