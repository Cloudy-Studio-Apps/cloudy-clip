import { z } from "zod";
import { defineCommand, LOCAL_ACTOR } from "@/core";
import { collabRef } from "./collab.ref";
import type { CollabApi, Collaborator } from "./collab.types";

const actor = z.string().describe("The collaborator");

function patch(api: CollabApi, id: string, change: Partial<Collaborator>): void {
  api.store.setState((state) => {
    const current = state.collaborators[id];
    if (!current || id === LOCAL_ACTOR) return state;
    return { collaborators: { ...state.collaborators, [id]: { ...current, ...change } } };
  });
}

/** Sets what a collaborator may do: edit the project, or only read it. */
export const setAccess = defineCommand({
  id: "collab.setAccess",
  label: "Set access",
  description: "Sets whether a collaborator can edit the project or only read it.",
  undoable: false,
  input: z.object({ actor, access: z.enum(["edit", "view"]) }),
  run(ctx, { actor, access }) {
    patch(ctx.require(collabRef), actor, { access });
  },
});

/** Pauses a collaborator or lets it go on. A call already running still finishes. */
export const setPaused = defineCommand({
  id: "collab.setPaused",
  label: "Pause agent",
  description: "Pauses a collaborator (its next calls are refused) or lets it go on.",
  undoable: false,
  input: z.object({ actor, paused: z.boolean() }),
  run(ctx, { actor, paused }) {
    patch(ctx.require(collabRef), actor, { paused });
  },
});

/** Disconnects an agent from this project until the user reconnects it or the app restarts. */
export const setBlocked = defineCommand({
  id: "collab.setBlocked",
  label: "Disconnect agent",
  description: "Disconnects an agent (its calls are refused) or reconnects it.",
  undoable: false,
  input: z.object({ actor, blocked: z.boolean() }),
  run(ctx, { actor, blocked }) {
    const { store } = ctx.require(collabRef);
    store.setState((state) => ({
      blocked: blocked
        ? [...state.blocked.filter((id) => id !== actor), actor]
        : state.blocked.filter((id) => id !== actor),
    }));
  },
});

/** Makes the user's playhead follow an agent's, or stops (null). Ends when the user moves it. */
export const follow = defineCommand({
  id: "collab.follow",
  label: "Follow agent",
  description: "Makes the user's preview follow a collaborator's playhead, or stops following.",
  undoable: false,
  input: z.object({ actor: z.string().nullable() }),
  run(ctx, { actor }) {
    ctx.require(collabRef).store.setState({ followed: actor });
  },
});

export const collabCommands = [setAccess, setPaused, setBlocked, follow];
