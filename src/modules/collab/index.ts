/**
 * Collab module: connected agents as collaborators. Who is here, what each may do, where they are
 * working, and following them.
 * @module collab
 */
/** Commands the popover runs. */
export { setAccess, setBlocked, setPaused } from "./collab.commands";
export type {
  CollabAccess,
  CollabActivity,
  CollabApi,
  CollabState,
  CollabTarget,
  Collaborator,
  CollaboratorKind,
} from "./collab.types";

/** Module definition, loaded by the app shell. */
export { collabModule } from "./collab.module";
/** Handle for `require(collabRef)` / `useModule(collabRef)`. */
export { collabRef } from "./collab.ref";
