import type { Collaborator } from "../collab.types";

/** The line under a collaborator's name. */
export function collabStatus(who: Collaborator, blocked: boolean): string {
  if (who.kind === "local") return "Owner · editing";
  if (blocked) return "Disconnected";
  if (who.paused) return "Paused";
  const access = who.access === "view" ? " · view only" : "";
  if (who.running > 0 && who.activity) return `${who.activity.label}…${access}`;
  if (who.idle) return `Idle${access}`;
  return `Agent · connected via MCP${access}`;
}
