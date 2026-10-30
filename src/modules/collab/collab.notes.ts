import type { ActorId } from "@/core";
import type { CollabNotes } from "./collab.types";

/** Creates the messages owed to agents. */
export function createCollabNotes(): CollabNotes {
  const notes = new Map<ActorId, string[]>();
  return {
    add: (actor, text) => void notes.set(actor, [...(notes.get(actor) ?? []), text]),
    take(actor) {
      const taken = notes.get(actor) ?? [];
      notes.delete(actor);
      return taken;
    },
  };
}
