import { useStore } from "zustand";
import { useHistory, useKernel, useModule } from "@/core";
import { Button, SegmentedControl, ToggleRow } from "@/ui";
import { follow, setAccess, setBlocked, setPaused } from "../collab.commands";
import { collabRef } from "../collab.ref";
import type { CollabAccess, Collaborator } from "../collab.types";

const ACCESS_OPTIONS = [
  { value: "edit", label: "Can edit" },
  { value: "view", label: "View only" },
] as const;

/** What the user can do about one agent. */
export function AgentControls({ who, blocked }: { who: Collaborator; blocked: boolean }) {
  const { bus, history } = useKernel();
  useHistory(); // the label below follows the history
  const undoLabel = history.undoLabelOf(who.id);
  const actor = who.id;
  const followed = useStore(useModule(collabRef).store, (state) => state.followed === actor);

  return (
    <div className="flex flex-col gap-2 border-y border-border py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Access</span>
        <SegmentedControl<CollabAccess>
          label={`What ${who.name} can do`}
          options={ACCESS_OPTIONS}
          value={who.access}
          disabled={blocked}
          onChange={(access) => void bus.run(setAccess, { actor, access })}
        />
      </div>
      <ToggleRow
        label="Follow agent"
        checked={followed}
        disabled={blocked}
        onChange={(on) => void bus.run(follow, { actor: on ? actor : null })}
      />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          disabled={blocked}
          onClick={() => void bus.run(setPaused, { actor, paused: !who.paused })}
        >
          {who.paused ? "Resume agent" : "Pause agent"}
        </Button>
        <Button size="sm" onClick={() => void bus.run(setBlocked, { actor, blocked: !blocked })}>
          {blocked ? "Reconnect" : "Disconnect"}
        </Button>
      </div>
      {undoLabel && (
        <Button
          size="sm"
          className="max-w-full justify-start truncate"
          title="Reverts this agent's latest step"
          onClick={() => void bus.execute("history.undoFor", { actor })}
        >
          Undo: {undoLabel}
        </Button>
      )}
    </div>
  );
}
