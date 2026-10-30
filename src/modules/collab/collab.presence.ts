import { LOCAL_ACTOR, type CommandBus, type History } from "@/core";
import type { PreviewApi } from "@/modules/preview";
import type { TimelineApi } from "@/modules/timeline";
import type { StoreApi } from "zustand/vanilla";
import { prune } from "./logic/prune";
import { changesTarget } from "./logic/targets";
import type { CollabNotes, CollabState } from "./collab.types";

/** How often quiet agents are looked for. */
const PRUNE_MS = 5000;

/** Tells an agent when the user undoes its step, and retires agents gone quiet. */
export function startPresence(
  store: StoreApi<CollabState>,
  notes: CollabNotes,
  deps: { bus: CommandBus; history: History; preview: PreviewApi; timeline: TimelineApi },
): () => void {
  const offExecuted = deps.bus.onExecuted(({ commandId, result, actor, changes }) => {
    if (commandId === "history.undoFor" && result.ok) {
      const { undone, actor: owner } = result.value as { undone: string; actor: string };
      notes.add(owner, `The user undid your step "${undone}".`);
    }
    const target = changesTarget(changes, deps.timeline.view.getState().selection);
    const who = store.getState().collaborators[actor];
    if (!target || !who || actor === LOCAL_ACTOR) return;
    store.setState((state) => ({
      collaborators: { ...state.collaborators, [actor]: { ...who, target } },
    }));
  });

  const timer = setInterval(() => {
    const { collaborators } = store.getState();
    const { idle, gone } = prune(Object.values(collaborators), Date.now());
    if (idle.length === 0 && gone.length === 0) return;
    const next = { ...collaborators };
    for (const id of idle) next[id] = { ...next[id]!, idle: true };
    for (const id of gone) {
      delete next[id];
      deps.history.reassign(id, LOCAL_ACTOR);
      deps.preview.dropClock(id);
    }
    store.setState({ collaborators: next });
  }, PRUNE_MS);

  return () => {
    offExecuted();
    clearInterval(timer);
  };
}
