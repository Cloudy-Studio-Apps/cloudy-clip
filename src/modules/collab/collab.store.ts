import { createStore } from "zustand/vanilla";
import { LOCAL_ACTOR } from "@/core";
import type { CollabState, Collaborator } from "./collab.types";

const YOU: Collaborator = {
  id: LOCAL_ACTOR,
  kind: "local",
  name: "You",
  color: "var(--primary)",
  avatar: "Y",
  access: "edit",
  paused: false,
  lastSeen: 0,
  running: 0,
  idle: false,
  activity: null,
  target: null,
};

/** Creates the collaborators of one kernel, with the local user in them. */
export function createCollabStore() {
  return createStore<CollabState>()(() => ({
    collaborators: { [LOCAL_ACTOR]: YOU },
    blocked: [],
    followed: null,
  }));
}
