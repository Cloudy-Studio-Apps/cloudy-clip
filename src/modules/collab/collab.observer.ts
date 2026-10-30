import { notify, type ActorId, type AppError, type McpCaller, type McpObserver } from "@/core";
import type { StoreApi } from "zustand/vanilla";
import { activityLabel } from "./logic/activity";
import { identify } from "./logic/identify";
import { toolTarget } from "./logic/targets";
import type { CollabNotes, CollabState, Collaborator } from "./collab.types";

/** Why a call is refused, or nothing. */
function refusal(state: CollabState, who: Collaborator, writes: boolean): AppError | null {
  if (state.blocked.includes(who.id)) {
    return {
      code: "collab.disconnected",
      message: "The user disconnected you from this project. They can reconnect you.",
    };
  }
  if (who.paused) {
    return {
      code: "collab.paused",
      message: "The user paused you. Wait for them before trying again.",
    };
  }
  if (who.access === "view" && writes) {
    return {
      code: "collab.view_only",
      message: "The user set you to view only: you can read the project but not change it.",
    };
  }
  return null;
}

/** Keeps the collaborators up to date with agents' calls, and refuses what the user forbade. */
export function createCollabObserver(
  store: StoreApi<CollabState>,
  notes: CollabNotes,
): McpObserver {
  const patch = (id: ActorId, change: Partial<Collaborator>) =>
    store.setState((state) => {
      const current = state.collaborators[id];
      if (!current) return state;
      return { collaborators: { ...state.collaborators, [id]: { ...current, ...change } } };
    });

  function join(caller: McpCaller): Collaborator {
    const { collaborators } = store.getState();
    const known = collaborators[caller.key];
    if (known) return known;
    const joined: Collaborator = {
      id: caller.key,
      kind: "agent",
      ...identify(caller.name, Object.values(collaborators)),
      access: "edit",
      paused: false,
      lastSeen: Date.now(),
      running: 0,
      idle: false,
      activity: null,
      target: null,
    };
    store.setState({ collaborators: { ...collaborators, [caller.key]: joined } });
    return joined;
  }

  return {
    connected: (caller) => void join(caller),
    call(caller, tool) {
      const who = join(caller);
      const deny = refusal(store.getState(), who, !tool.readOnly);
      if (deny) return { deny };
      patch(who.id, {
        running: who.running + 1,
        lastSeen: Date.now(),
        idle: false,
        activity: { label: activityLabel(tool.name, "running"), status: "running" },
        target: toolTarget(tool.name) ?? who.target,
      });
      return { label: activityLabel(tool.name, "done") };
    },
    finished(caller, tool, result) {
      const who = store.getState().collaborators[caller.key];
      if (who) {
        const failed = result.isError === true;
        const label = activityLabel(tool.name, failed ? "running" : "done");
        patch(who.id, {
          running: Math.max(0, who.running - 1),
          lastSeen: Date.now(),
          activity: { label, status: failed ? "error" : "done" },
        });
        if (failed) notify("error", `${who.name}: ${label.toLowerCase()} failed`);
      }
      return notes.take(caller.key);
    },
  };
}
