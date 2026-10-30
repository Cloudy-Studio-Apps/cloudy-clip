# Collaboration mode (agents as collaborators)

## Context

Today an agent edits the live project anonymously: every call is `origin: "agent"`, it shares the user's playhead, and `preview_capture_frame` pauses and seeks the user's preview. Nothing shows who is connected. The user wants what Cloudy Canvas has: a connected agent appears as a person at the top, with a virtual cursor, and works independently of the user whether they left the app or are editing in it. Agent-only now, but shaped as a real collaborator so human collaborators can join later.

The look is `docs/prototype/` (`collab.js`, `index.html:39-80`, `styles.css` "Collaborators"). The behaviour model is Canvas (`src/app/mcp/agent-presence-source.ts`, `docs/collaboration.md`).

## Decided by the user

- It must hold both when the user is away from the app and when they are editing in it.
- **Own playhead:** the agent seeks and captures on its own; the user's preview never moves unless they press Follow.
- **Separate undo:** Ctrl+Z undoes only the user's steps. This overrides the prototype's shared stack.
- **Arrow pointer everywhere:** a Canvas-style pointer travels to what the agent touches across media, timeline, inspector and preview.

## Calls I made (change any of these)

- Everything in the prototype's popover ships: avatar stack, status strip, Can edit / View only, Follow, Pause, Disconnect, the "connect another agent" snippet.
- **Stop and Pause are the same thing and can't interrupt.** MCP has no way to stop an agent's thinking, so the running call finishes and later calls are refused with `collab.paused`, a message the agent can read.
- **Disconnect** refuses calls the same way and offers Reconnect. It does not kill the MCP session.
- **Follow is off by default** (the prototype had it on), and it moves the user's playhead and timeline scroll. Any seek, scrub or play by the user turns it off.
- The agent also gets a dashed playhead line on the timeline, because its own playhead must be visible. The arrow is the pointer, the line is where it is in time.
- A new agent's playhead starts at the user's playhead.
- An agent undoes only its own steps with `history_undo`, and is told when the user undoes one of them (note appended to its next reply, as in Canvas).
- If an undo clashes with later work, it is refused and says why: "Can't undo: Claude Code changed this clip afterwards". No partial undo, and no skipping past a blocked step.
- When an agent is gone for good, its remaining steps pass to the user's Ctrl+Z.
- `preview_play` for an agent only advances its own virtual clock: no audio, nothing drawn.
- Access, pause and follow are ephemeral (not saved in the project).

## Approach

### 1. Spike first: capture with the window hidden (throwaway)

This is the main technical risk, and it decides stage 4. Nothing in `src` handles hidden windows, and `preview.controller.ts:112` waits on `requestAnimationFrame` with no timeout, so capture can hang until the bridge's 30 s error. `backgroundThrottling` is believed unsupported on Linux and Windows (verify).

Prove on WebKitGTK, with the window minimized and covered, and then on WebView2: a detached `HtmlMediaEngine` canvas, driven by `setTimeout`, captures the correct frame.

- **Pass on both:** build stage 4 as written.
- **Fail on either:** Rust grabs media frames with FFmpeg for the offscreen path on all platforms (already a system dependency), behind the same `captureAt` call, so there is only one path to maintain. It draws text and junctions over those frames.
- The Windows half needs a Windows machine.

### 2. Identity: who is calling

- Rust (`src-tauri/src/mcp/server.rs`, `bridge.rs`): read `context.peer.peer_info()` and the session header from `Parts` in `call_tool`; add `client: { key, name, version }` to `CallPayload`. Emit a connect event from `on_initialized`. There is no disconnect hook, so presence ends by last-seen expiry.
- **Rust owns the stable key.** It maps sessions to a stable actor key, so TypeScript, history and clocks never see a session change. A new session with a client name whose existing key has been silent for over 300 s (rmcp's session expiry) reuses that key: it's the same agent reconnecting. Otherwise it mints a new key, and the client gets a number. A second agent silent that long can be mistaken for a reconnect; accepted.
- **Name source:** `peer_info()`, but on the stateless `2026-07-28` path `tower.rs:2415` returns rmcp's own build name, so read `_meta["io.modelcontextprotocol/clientInfo"]` there, then User-Agent. Identity never depends on `Mcp-Session-Id`.
- `src/core/mcp`: `McpCall.caller`, passed in `McpToolContext`; `commandTool` runs with `{ origin: "agent", actor: caller.key }`. New `McpObserver` (`connected`, `call` → `{ deny? }`, `finished` → notes to append), modelled on Canvas and registered through `ctx.mcp`, since the bridge is created after modules load. `core` stays ignorant of collab: it only offers the hook. Fix: hand-written tools no longer pick their own origin (`media.mcp.ts:29`), the bridge supplies it.
- `src/core/command`: add `actor: ActorId` to `ExecuteOptions`, `Transaction`, `CommandContext`, `CommandExecutedEvent` and `HistoryEntry`. The local user is `LOCAL_ACTOR`. `CommandExecutedEvent` also carries the changes, for pointer targets.

### 3. Per-actor undo (`src/core/history`)

One ordered log, tagged by actor. `undo(actor)` reverts that actor's latest step if no later step by anyone else clashes with it. `redo(actor)` mirrors it, and a new edit clears only that actor's redo. The latest-step path used by a single actor stays as it is today (inverse patches).

- **Why Immer patches can't drive out-of-order undo:** they address arrays by index, and the commands write whole records (`commitState` in `timeline.junctions.ts:167` replaces `tracks/<id>` and `clips/<id>`; `element.commands.ts:58` replaces all of `props`). The patches say almost nothing about which fields changed.
- **So each step also records a field diff.** `createPatchableStore` takes an optional policy, supplied by `project`:
  - `diff(before, after)` compares the two states by reference, collection by collection, down to fields: `clips/<id>/start`, `clips/<id>/props/<key>`, `clips/<id>/transform/<key>`, `tracks/<id>/muted`, `junctions/<id>/<field>`, `media/<id>`. Each result is `{ key, before, after }`. This needs no change to any command.
  - Out-of-order undo writes the `before` values. Two steps clash when a key of one is a prefix of a key of the other. A created or deleted entity's key is `clips/<id>`, so it clashes with any field of that entity.
  - `tracks/*/clipIds`, `trackOrder` and `mediaOrder` are never keys. `repair(draft)` rebuilds them: `clipIds` from `clip.trackId`, sorted by `start`; the two order lists drop missing ids and append restored ones at the end, so a restored track can land in a different position (accepted).
  - `validate(state)` runs afterwards, and any failure rolls back and returns `history.conflict`. Disjoint fields can still make a bad document, so it checks: `findLayoutConflict`; every clip's `trackId` and `mediaId` exist; `staleJunctions` is empty; one junction per cut. This refuses, for example, undoing a track the user has since put a clip on, or an import the user has since placed.
- **Redo** runs the same clash check and `validate`.
- `history.undo` / `history.redo` act for `ctx.actor`.
- **Scoping is switched on by `collab`:** without it, Ctrl+Z still reaches every step, as today. `collab` calls `history.scopeUndo()` in `setup`. This keeps the promise that the user can always undo an agent, even if the optional module doesn't load or between stages.
- New `history.undoFor { actor }`, user-only with no MCP tool: reverts that actor's latest step, connected or gone, and queues the note to the agent. In the UI, each agent's popover row gets an "Undo: <label>" button, as Canvas has (`collaborator-undo-button.tsx`). This is an addition to the prototype.
- `history_list` shows who made each step. `reassign(from, to)` hands over a departed agent's steps. `bootstrap.ts:55-63`: toast names the agent instead of "Agent:".

Tests here are justified by the kernel rule: out-of-order undo with interleaved actors, the `diff`, array rebuild, clash refusal, each `validate` refusal, redo after clash.

### 4. Own playhead and offscreen capture (`preview`)

- `logic/virtual.clock.ts`: time computed from wall clock on read, no rAF, clamped to the timeline on read. `preview.clockFor(actor)` returns the user's clock or that actor's virtual one; `preview.seek`, `play`, `pause`, `togglePlay` use `ctx.actor`. So does `timeline.addElement` when no `start` is given (`timeline.element.command.ts:43`), or an agent's clip would land at the user's position. Virtual clocks are dropped when the actor leaves.
- One exception stays: an edit that shortens the timeline can still clamp the user's playhead (`preview.controller.ts:78`). It has to, since that time no longer exists.
- `preview.capture.ts`: one lazily created `HtmlMediaEngine` on a detached canvas at project format size, `pictureOnly` (skips audio tracks), waits with `setTimeout`, disposed after 30 s idle. Captures are queued. It never touches the user's clock or panel, and works with the preview panel unmounted.
- `captureAt(time)` replaces `controller.captureFrame`. Uses `canvas.toBlob`, not `toDataURL`, so encoding doesn't stall the user's playback. An unsettled frame is an error, not the silently stale picture it is today (`preview.controller.ts:104-108`).
- Tool descriptions and the server instructions change from "the playhead" to "your playhead".

### 5. `collab` module (`src/modules/collab/`, tier `feature`, `requires: ["preview", "timeline", "project"]`)

- `collab.store.ts`: per-kernel store of `Collaborator { id, kind: "local" | "agent" | "human", name, color, avatar, access, paused, lastSeen, running, activity, target }`. `human` is reserved so people can join later without a remodel.
- `logic/identify.ts`: client name to display name and brand colour (Claude `#d97757`), numbered if there are two. `logic/activity.ts`: tool name to a sentence, stamped on undo steps too. `logic/targets.ts`: changes and tool name to a target (see below).
- `collab.mcp.ts`: `collab_get_user_context` returns the user's playhead and selection. Without it, "cut here" stops working once playheads are separate.
- Registers the `McpObserver`: joins and updates collaborators, denies with `collab.paused`, `collab.view_only` or `collab.disconnected`. View only blocks tools that write; `McpToolDefinition` gets `readOnly`, defaulting to false so a forgotten flag is safe; `commandTool` derives it from `command.undoable`.
- View only also has to stop `history_undo` and `history_redo`: they are `undoable: false` yet change the project, so `commandTool` takes an explicit `writes: true` for them.
- A pure `prune` on a 5 s timer: idle after 2 min, gone after 15 min (then `reassign`).
- **Disconnect lasts until the app restarts.** The block is kept by actor key and outlives pruning. Refused calls don't count as activity, so they don't update `lastSeen`.
- UI: `CollabAvatars`, `CollabPopover`, `AgentStatusStrip`, contributed through a new shell point `topBarItems` (read by `TopBar.tsx:17`, wrapped in `ErrorBoundary`). Avatars are round, as the prototype notes; add that one exception to the rule on shapes.

### 6. Pointer, agent playhead, Follow

- **Targets need no module knowledge.** `collab` is a feature and core modules can't import it, so they only add a plain DOM attribute: `data-collab-target="clip:<id>"`, `media:<id>`, `panel:<id>`, `inspector:<section>`.
- `logic/targets.ts` picks the target from the changed paths: `media/*` → the media card; `clips/*` → the clip, or the inspector section when that clip is what the user has selected (the inspector shows the user's selection, not the agent's); `preview_*` tools → the preview panel; reads don't move it.
- `AgentPointer` lives in a new shell point `appOverlays`, a fixed full-window layer with `pointer-events: none`. It moves with CSS `transform` transitions and imperative subscriptions only (rule on per-frame paths). It re-resolves on target change, timeline scroll or zoom, and panel resize.
- **Offscreen or virtualized clip:** no DOM node exists, so it sits at the panel edge nearest the clip. A hidden tab falls back to its rail button. It never scrolls the user's view. This needs new `TimelineApi` exports, since none exist today: `clipBox(id)`, a scroll subscription and `scrollToTime`.
- `AgentPlayhead`: dashed line and clip highlight, through a new `timelineOverlays` point owned by `timeline`, rendered beside `Playhead.tsx` outside the virtualized pages.
- `collab.follow` command: Follow seeks the user's clock to the agent's and scrolls the timeline. It ends when `clock.onTime` reports a time other than the one Follow just set, because scrubs call `playback.seek` directly (`Ruler.tsx:31`, `TrackLane.tsx:93`) and never reach the bus.

## Key files

- Rust: `src-tauri/src/mcp/server.rs`, `bridge.rs`
- Core: `src/core/mcp/{mcp.bridge,mcp.tool,mcp.types,mcp.transport.tauri}.ts`, `src/core/command/{command.bus,command.types}.ts`, `src/core/history/*`, `src/core/store/store.patchable.ts`, `src/core/shell/shell.points.ts`
- Shell: `src/app/top-bar/TopBar.tsx`, `src/app/layout/LayoutHost.tsx`, `src/app/bootstrap.ts`
- Modules: `preview/{preview.commands,preview.controller,preview.mcp,preview.module}.ts`, `preview/engine/engine.html.ts`, `timeline/ui/TimelinePanel.tsx`, `timeline/timeline.element.command.ts`, `timeline/index.ts`, `media/media.mcp.ts`, `project` (store policy: `diff`, `repair`, `validate`), new `collab/`
- Docs: READMEs of each touched folder, `docs/architecture.md`, CLAUDE.md rule on who reads which point, and the avatar shape exception
- Reuse: `findLayoutConflict`, `defineMcpTool`, `HtmlMediaEngine`, `SegmentedControl`, `Button`, `notify`, prototype CSS and the `claude-spark` SVG

## Order

Each stage ships on its own, in the order above. The design goes to `docs/superpowers/specs/2026-10-30-collaboration-design.md` on approval, then a task plan.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test`; `cargo clippy --all-targets -- -D warnings`, `cargo test`.
- Connect Claude Code to a running app (`pnpm tauri dev`) and check by hand:
  - The avatar appears with the right name and colour within one call, and a second client gets a number.
  - Minimize the window, have the agent edit and capture at several times; frames are correct and no call times out. Repeat on Windows.
  - Play in the preview while the agent seeks and captures: the user's playhead doesn't move, playback doesn't stutter noticeably.
  - Agent trims, user moves another clip on the same track, each undoes: both work and the track stays sorted.
  - Agent edits a clip, user edits the same field, agent's `history_undo`: refused with a clear message.
  - Agent adds a track, user puts a clip on it, agent undoes: refused, nothing changes.
  - Undo an agent step from its popover row: it reverts, and the agent's next reply mentions it.
  - The pointer reaches a media card, a clip, an offscreen clip (panel edge) and the inspector.
  - Pause: next call returns `collab.paused`. View only: reads work, edits are refused. Follow moves the preview and stops when the user scrubs.

## Spike result

Run 2026-10-30 with a throwaway `preview_spike_capture` tool.

- `backgroundThrottling` is unsupported on Linux and Windows (`tauri-utils` 2.10 docs), so nothing relies on it.
- **Linux (WebKitGTK on niri): pass.** A detached `HtmlMediaEngine`, driven by `setTimeout`, captured the exact frame on a window moved to another workspace, including after 45 s hidden: 16 of 16 random frames, each read from the timecode burned into the test video, in 0.3 to 1 s each.
- The spike found a real bug: seeking before metadata can present frame 0 as the target frame, while the engine reports it settled. Fixed by not seeking until `HAVE_METADATA`; it would have made captures silently wrong.
- `document.hidden` stayed false while hidden on niri, so nothing may depend on visibility events.
- niri has no minimize, so "another workspace" stands in for minimized and covered.
- **Windows (WebView2): not run yet.** It needs the Windows machine.

## Found in live use

Claude Code speaks the stateless `2026-07-28` protocol when offered it: no session id, and nothing in its headers or `_meta` identifies an instance (`claudecode/toolUseId` is per call). Each call then looked like a new or returning agent. So the server offers versions only up to `2025-11-25`, which makes clients use `initialize` and hold a real session. Two Claude Code instances are two collaborators. A client without a session id still gets one stable key per name.
