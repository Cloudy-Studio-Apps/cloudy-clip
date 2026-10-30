import type { Collaborator } from "../collab.types";
import { AgentControls } from "./AgentControls";
import { CollabAvatar } from "./CollabAvatar";
import { collabStatus } from "./collab.status";

const CONNECT_COMMAND = "claude mcp add --transport http cloudy-clip http://127.0.0.1:7420/mcp";

interface CollabPanelProps {
  people: readonly Collaborator[];
  blocked: readonly string[];
}

/** Who is in this project and what the user can do about them. */
export function CollabPanel({ people, blocked }: CollabPanelProps) {
  return (
    <div className="flex w-80 flex-col gap-1">
      <h2 className="px-1 pt-1 text-2xs font-semibold tracking-wide text-subtle-foreground uppercase">
        In this project
      </h2>
      {people.map((who) => {
        const off = blocked.includes(who.id);
        return (
          <div key={who.id} className="flex flex-col gap-1.5 px-1 py-1">
            <div className="flex items-center gap-2.5">
              <CollabAvatar who={who} off={off} />
              <div className="flex min-w-0 flex-col">
                <b className="text-xs font-medium">{who.name}</b>
                <span className="truncate text-2xs text-muted-foreground">
                  {collabStatus(who, off)}
                </span>
              </div>
            </div>
            {who.kind === "agent" && <AgentControls who={who} blocked={off} />}
          </div>
        );
      })}
      <div className="flex flex-col gap-1 px-1 pt-1 pb-1">
        <span className="text-2xs text-muted-foreground">Connect another agent</span>
        <code className="rounded-xs bg-surface-sunken px-1.5 py-1 font-mono text-2xs break-all select-all">
          {CONNECT_COMMAND}
        </code>
      </div>
    </div>
  );
}
