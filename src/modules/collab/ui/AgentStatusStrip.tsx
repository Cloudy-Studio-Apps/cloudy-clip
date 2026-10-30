import { useMemo } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { Button } from "@/ui";
import { setPaused } from "../collab.commands";
import { collabRef } from "../collab.ref";
import { ClaudeMark } from "./ClaudeMark";

/** Shown while an agent is working, with a way to stop it. */
export function AgentStatusStrip() {
  const { bus } = useKernel();
  const { store } = useModule(collabRef);
  const collaborators = useStore(store, (state) => state.collaborators);
  const who = useMemo(
    () => Object.values(collaborators).find((c) => c.kind === "agent" && c.running > 0),
    [collaborators],
  );
  if (!who) return null;

  return (
    <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      {who.avatar === "claude" && <ClaudeMark className="size-4 rounded-full" />}
      <span>{who.name} is editing</span>
      <Button
        size="sm"
        title="Refuses its next calls. What it is doing now still finishes."
        onClick={() => void bus.run(setPaused, { actor: who.id, paused: true })}
      >
        Stop
      </Button>
    </div>
  );
}
