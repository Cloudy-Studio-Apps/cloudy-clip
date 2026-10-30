import type { ActorId } from "@/core";
import type { StoreApi } from "zustand/vanilla";

/** Who a collaborator is. `human` is for people joining later. */
export type CollaboratorKind = "local" | "agent" | "human";

/** What a collaborator may do to the project. */
export type CollabAccess = "edit" | "view";

/** The thing a collaborator is working on, named as `data-collab-target` names it on screen. */
export type CollabTarget = `${"clip" | "media" | "panel" | "inspector"}:${string}`;

/** What a collaborator is doing, or last did. */
export interface CollabActivity {
  label: string;
  status: "running" | "done" | "error";
}

/** Someone in this project: the local user or a connected agent. */
export interface Collaborator {
  id: ActorId;
  kind: CollaboratorKind;
  name: string;
  /** Their brand or assigned color, for the avatar, pointer and playhead. */
  color: string;
  /** `claude` shows the Claude mark; anything else is the initial shown. */
  avatar: string;
  access: CollabAccess;
  paused: boolean;
  /** Milliseconds since the epoch of their last accepted call. */
  lastSeen: number;
  /** Calls in progress. */
  running: number;
  /** Quiet for a few seconds: its pointer, outline and playhead fade out until its next call. */
  resting: boolean;
  /** Quiet for a while, but still around. */
  idle: boolean;
  activity: CollabActivity | null;
  target: CollabTarget | null;
}

/** A point on screen, in pixels from the window's top left. */
export interface PointerSpot {
  x: number;
  y: number;
}

/** Everyone here. View state: never in the project, never in history. */
export interface CollabState {
  collaborators: Record<ActorId, Collaborator>;
  /** Agents the user disconnected. Kept apart so it outlives their collaborator. */
  blocked: ActorId[];
  /** Whose playhead the user's preview follows. */
  followed: ActorId | null;
}

/** The collab module's API for one kernel. */
export interface CollabApi {
  /** Read with `useStore(api.store, selector)`. */
  readonly store: StoreApi<CollabState>;
}

/** Who has been quiet too long. */
export interface PruneResult {
  /** Stopped working a moment ago. */
  resting: ActorId[];
  /** Went idle. */
  idle: ActorId[];
  /** Gone for good. */
  gone: ActorId[];
}

/** What a known client looks like. */
export interface KnownClient {
  match: RegExp;
  name: string;
  color: string;
  avatar: string;
}

/** The collaborator details worked out from a client's name. */
export interface ClientIdentity {
  name: string;
  color: string;
  avatar: string;
}

/** Messages owed to agents, each sent once with their next reply. */
export interface CollabNotes {
  add(actor: ActorId, text: string): void;
  /** The actor's notes, then forgets them. */
  take(actor: ActorId): string[];
}
