import type { Collaborator, PruneResult } from "../collab.types";

/** Quiet this long, an agent's marks on screen fade out: a frozen pointer looks broken. */
const REST_MS = 4000;
/** Quiet this long, a collaborator shows as idle. */
const IDLE_MS = 2 * 60_000;
/** Quiet this long, an agent is taken to be gone. */
const GONE_MS = 15 * 60_000;

/** Which agents have been quiet too long. An agent with a call running never is. */
export function prune(collaborators: readonly Collaborator[], now: number): PruneResult {
  const result: PruneResult = { resting: [], idle: [], gone: [] };
  for (const collaborator of collaborators) {
    if (collaborator.kind !== "agent" || collaborator.running > 0) continue;
    const quiet = now - collaborator.lastSeen;
    if (quiet >= REST_MS && !collaborator.resting) result.resting.push(collaborator.id);
    if (quiet >= GONE_MS) result.gone.push(collaborator.id);
    else if (quiet >= IDLE_MS && !collaborator.idle) result.idle.push(collaborator.id);
  }
  return result;
}
