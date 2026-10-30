# collab

Connected agents as collaborators, shaped so people can join later (`CollaboratorKind` has `human`). Each agent shows up with an avatar and name, and works next to the user without disturbing them: its own playhead and undo live in `preview` and `core`; this module tracks who is here, what they may do and where they are working.

- **Tier:** feature
- **Requires:** `preview` (`clockFor`, `dropClock`), `timeline` (selection for `collab_get_user_context`)
- **Contributes:** `topBarItems` (`collab.status`, `collab.avatars`), `appOverlays` (`collab.pointers`), `timelineOverlays` (`collab.playheads`), the commands and tool below; `ctx.mcp.observe`; `history.scopeUndo` (from here on Ctrl+Z means the user's own steps) and `history.nameActors`.
- **API:** `CollabApi`: `store` (`CollabState`: `collaborators`, `blocked`, `followed`).
- **Commands:** `collab.setAccess { actor, access }`, `collab.setPaused { actor, paused }`, `collab.setBlocked { actor, blocked }`, `collab.follow { actor | null }`. Not MCP tools: only the user decides these.
- **Tools:** `collab_get_user_context`: the user's playhead, whether they are playing, their selection.
- **Files:**
  - `collab.observer.ts`: the `McpObserver`. Joins agents, names steps, refuses calls with `collab.disconnected`, `collab.paused` or `collab.view_only`. Refused calls don't count as activity.
  - `collab.presence.ts`: tells an agent when the user undid its step (sent with its next reply), and retires agents every 5 s: idle after 2 min, gone after 15 min, when their steps pass to the user and their playhead is dropped.
  - `collab.notes.ts`: messages owed to agents.
  - `collab.follow.ts`: while following, the user's playhead and timeline go where the agent's playhead goes. Off by default. Any other time on the user's clock, or play, ends it: scrubs never reach the bus, so the clock is the only place to see them.
  - `logic/identify.ts`, `logic/activity.ts`, `logic/prune.ts`: name and color of a client; a sentence for a tool; who has been quiet too long.
  - `logic/targets.ts`, `logic/locate.ts`: what an agent is touching (from a tool's name, then the fields a command changed) and where that is on screen. A clip no page has rendered gives the timeline's nearest edge; a card or section not on screen gives its panel, then its rail tab. Other modules only mark elements with `data-collab-target` (`clip:`, `media:`, `panel:`, `inspector:`), so they import nothing from here.
  - `ui/`: `AgentPointers` (app overlay: an arrow and label per agent, moved with `transform`), `AgentPlayheads` (timeline overlay: a dashed line per agent, and an outline on the clip it is on, by a CSS rule on `data-collab-target`, so it holds for clips the timeline hasn't rendered yet), `CollabAvatars` (top bar, right; opens `CollabPanel`), `AgentStatusStrip` (top bar, center, while an agent works), `AgentControls`, `CollabAvatar`, `ClaudeMark`, `collab.status.ts`.
- **Rules:**
  - Stop and Pause can't interrupt: the running call finishes, later ones are refused.
  - Disconnect refuses calls until the user reconnects or the app restarts. `blocked` is apart from `collaborators` so it outlives them. It doesn't close the MCP session.
  - An agent joins on `mcp://connected`. Clients on the stateless protocol send no such event, so they join on their first call.
  - The actor key comes from Rust (`src-tauri/src/mcp/actors.rs`), which keeps it stable across reconnects. A second agent with the same client name that has been silent for 300 s can be mistaken for a reconnect. Claude Code speaks the stateless protocol: no session id and nothing that tells two instances apart, so all its instances on this machine are one collaborator, sharing a playhead and undo steps.
