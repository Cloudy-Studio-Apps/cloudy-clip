import { cn } from "@/ui";
import type { Collaborator } from "../collab.types";
import { ClaudeMark } from "./ClaudeMark";

interface CollabAvatarProps {
  who: Collaborator;
  /** Disconnected: shown grey, with no presence dot. */
  off?: boolean;
  className?: string;
}

/** A collaborator's face. Round: the one place a circle earns its keep. */
export function CollabAvatar({ who, off, className }: CollabAvatarProps) {
  const working = who.running > 0;
  return (
    <span
      className={cn(
        "relative grid size-7 shrink-0 place-items-center rounded-full border-2 border-surface text-xs font-semibold text-primary-foreground",
        off && "opacity-55 grayscale",
        className,
      )}
      style={{
        backgroundColor: who.color,
        boxShadow: working ? `0 0 0 2px ${who.color}` : undefined,
      }}
    >
      {who.avatar === "claude" ? <ClaudeMark className="size-full rounded-full" /> : who.avatar}
      {who.kind === "agent" && !off && (
        <i
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface",
            who.idle || who.paused ? "bg-subtle-foreground" : "bg-online",
          )}
        />
      )}
    </span>
  );
}
