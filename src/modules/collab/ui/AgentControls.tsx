import { useHistory, useKernel } from "@/core";
import { Button, SegmentedControl } from "@/ui";
import { setAccess, setBlocked, setPaused } from "../collab.commands";
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
