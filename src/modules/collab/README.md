# collab

Connected agents as collaborators, shaped so people can join later (`CollaboratorKind` has `human`). Each agent shows up with an avatar and name, and works next to the user without disturbing them: its own playhead and undo live in `preview` and `core`; this module tracks who is here, what they may do and where they are working.

- **Tier:** feature
- **Requires:** `preview` (`clockFor`, `dropClock`), `timeline` (selection for `collab_get_user_context`)
- **Contributes:** the command and tool below; `ctx.mcp.observe`; `history.scopeUndo` (from here on Ctrl+Z means the user's own steps) and `history.nameActors`.
- **API:** `CollabApi`: `store` (`CollabState`: `collaborators`, `blocked`, `followed`).
- **Commands:** `collab.setAccess { actor, access }`, `collab.setPaused { actor, paused }`, `collab.setBlocked { actor, blocked }`. Not MCP tools: only the user decides these.
- **Tools:** `collab_get_user_context`: the user's playhead, whether they are playing, their selection.
- **Files:**
  - `collab.observer.ts`: the `McpObserver`. Joins agents, names steps, refuses calls with `collab.disconnected`, `collab.paused` or `collab.view_only`. Refused calls don't count as activity.
  - `collab.presence.ts`: tells an agent when the user undid its step (sent with its next reply), and retires agents every 5 s: idle after 2 min, gone after 15 min, when their steps pass to the user and their playhead is dropped.
  - `collab.notes.ts`: messages owed to agents.
  - `logic/identify.ts`, `logic/activity.ts`, `logic/prune.ts`: name and color of a client; a sentence for a tool; who has been quiet too long.
- **Rules:**
  - Stop and Pause can't interrupt: the running call finishes, later ones are refused.
  - Disconnect refuses calls until the user reconnects or the app restarts. `blocked` is apart from `collaborators` so it outlives them. It doesn't close the MCP session.
  - The actor key comes from Rust (`src-tauri/src/mcp/actors.rs`), which keeps it stable across reconnects. A second agent with the same client name that has been silent for 300 s can be mistaken for a reconnect.
