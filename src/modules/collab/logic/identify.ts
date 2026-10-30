import type { ClientIdentity, Collaborator, KnownClient } from "../collab.types";

/** Clients with a name and color of their own. */
const KNOWN_CLIENTS: KnownClient[] = [
  { match: /claude/i, name: "Claude Code", color: "#d97757", avatar: "claude" },
  { match: /codex/i, name: "Codex", color: "#10a37f", avatar: "C" },
  { match: /cursor/i, name: "Cursor", color: "#7c8cf8", avatar: "C" },
  { match: /gemini/i, name: "Gemini CLI", color: "#4285f4", avatar: "G" },
  { match: /copilot|visual studio code|vscode/i, name: "VS Code", color: "#3b9eff", avatar: "V" },
];

/** Colors for everyone else, in order of arrival. */
const FREE_COLORS = ["#c084fc", "#34d399", "#fbbf24", "#f472b6", "#60a5fa"];

/** How a client appears: a known one by its brand; a second of one name gets a number. */
export function identify(clientName: string, others: readonly Collaborator[]): ClientIdentity {
  const known = KNOWN_CLIENTS.find((client) => client.match.test(clientName));
  const base = known?.name ?? clientName;
  const taken = new Set(others.map((other) => other.name));
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
  const used = new Set(others.map((other) => other.color));
  const color = known?.color ?? FREE_COLORS.find((free) => !used.has(free)) ?? FREE_COLORS[0]!;
  return { name, color, avatar: known?.avatar ?? base.charAt(0).toUpperCase() };
}
