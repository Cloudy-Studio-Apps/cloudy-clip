# Collaboration Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A connected MCP agent appears as a collaborator with an avatar and an arrow pointer, and has its own playhead, capture and undo, so it neither disturbs the user nor depends on the window being visible.

**Architecture:** Rust gives each MCP client a stable actor key. The key travels through the bridge and the command bus into a per-actor undo log. Preview gives each actor a virtual clock and a shared offscreen capture engine. A new `collab` feature module owns presence, access, UI and the pointer, and reaches core only through generic hooks (`McpObserver`, shell points, DOM attributes).

**Tech Stack:** Tauri 2, rmcp 3.7, React 19, TypeScript strict, Zustand, Immer, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-collaboration-design.md`. Read it first: the reasons live there.

## Global Constraints

- Every rule in `CLAUDE.md` applies. A change is done when `pnpm typecheck`, `pnpm lint` and `pnpm test` pass; Rust changes also pass `cargo clippy --all-targets -- -D warnings` and `cargo test`.
- Tests only for the kernel, document integrity, or a bug nothing else would catch (rule 3). The UI, `collab` and preview get manual checks, not tests.
- Commit messages have no `Co-Authored-By` line.
- Update the `README.md` of each folder changed, in the same commit, in the template of `docs/modules.md`.
- Commit each task. Do not push.
- All times are integer `Micros`. New exports of an `index.ts`, commands and tools have TSDoc.
- Keys are exact: `collab.paused`, `collab.view_only`, `collab.disconnected`, `history.conflict`. Idle 2 min, gone 15 min, prune every 5 s, session reuse after 300 s, capture engine disposed after 30 s idle, capture settle limit 3 s.
- Refusal copy: `Can't undo: <name> changed this afterwards ("<label>")`.

## Review Focus

Each is pinned by a test in the task named.

1. An undo after an earlier out-of-order undo must not use stale index patches, or the track's clip list is corrupted (Task 5).
2. Redo after someone else edited the same field must be refused, not overwrite their work (Task 5).
3. A step touching a store with no policy cannot go out of order, and must refuse rather than crash (Task 5).
4. A departed agent's redo steps must vanish, not stay reachable by the user (Task 6).
5. With `collab` not loaded, Ctrl+Z must still reach agent steps (Task 6).

---

## Stage 1: Spike

### Task 1: Hidden-window capture spike (throwaway)

**Files:** a `spike/hidden-capture` branch, never merged. Record the result in the spec under a new `## Spike result` section on the main branch.

**Interfaces:** Produces a yes/no per platform that decides Task 8.

- [ ] **Step 1: Check `backgroundThrottling`.** Read the Tauri 2 `WindowConfig` docs for the installed version. Record whether it applies to Linux and Windows.

- [ ] **Step 2: Add a temporary tool `preview_spike_capture { time }`.** It creates an `HtmlMediaEngine` on `document.createElement("canvas")` at project format size, calls `render(project, time, false)` every 30 ms by `setTimeout` until `isSettled()` or 3 s, then returns `captureFrame()` plus elapsed ms and whether it settled.

- [ ] **Step 3: Run on Linux with `pnpm tauri dev`.** With a project holding two video clips and a text clip, capture 5 distinct times in each state: visible, minimized, fully covered by another window, on another workspace. Pass means every frame shows the right picture, settled, under 3 s.

- [ ] **Step 4: Run the same on Windows (WebView2).** This needs the user's Windows machine; ask them.

- [ ] **Step 5: Record the result in the spec and delete the branch.**

**Gate:** pass on both, Task 8 as written. Fail on either: stop and report. Task 8's FFmpeg variant needs its own plan section written from what the spike showed.

---

## Stage 2: Identity

### Task 2: Stable actor keys in Rust

**Files:**
- Create: `src-tauri/src/mcp/actors.rs`
- Modify: `src-tauri/src/mcp/server.rs`, `src-tauri/src/mcp/bridge.rs`, `src-tauri/src/mcp/mod.rs`

**Interfaces:**
- Produces: `struct McpClient { key: String, name: String, version: Option<String> }` (serde camelCase). `bridge.call(name, arguments, &client)`. The `mcp://call` payload gains `caller: McpClient`. New event `mcp://connected` with an `McpClient` payload.

- [ ] **Step 1: Write the failing test in `actors.rs`**

```rust
#[test]
fn reuses_a_key_only_after_the_old_session_went_silent() {
    let mut actors = ActorMap::default();
    let t0 = Instant::now();
    let a = actors.resolve(Some("s1"), "Claude Code", t0);
    assert_eq!(actors.resolve(Some("s1"), "Claude Code", t0), a);
    let b = actors.resolve(Some("s2"), "Claude Code", t0 + secs(10));
    assert_ne!(a, b, "a second live client is a new actor");
    let c = actors.resolve(Some("s3"), "Claude Code", t0 + secs(400));
    assert!(c == a || c == b, "a reconnect takes over a silent key");
}

#[test]
fn clients_without_a_session_share_a_key_by_name() {
    let mut actors = ActorMap::default();
    let t0 = Instant::now();
    assert_eq!(actors.resolve(None, "Codex", t0), actors.resolve(None, "Codex", t0));
    assert_ne!(actors.resolve(None, "Codex", t0), actors.resolve(None, "Cursor", t0));
}
```

- [ ] **Step 2: Run it:** `cd src-tauri && cargo test actors`. Expected: FAIL, no `ActorMap`.

- [ ] **Step 3: Implement `ActorMap::resolve(&mut self, session: Option<&str>, name: &str, now: Instant) -> String`.** Keys are `agent-<n>`. Silence limit is `const SESSION_EXPIRY: Duration = Duration::from_secs(300)`. Prefer the longest-silent key on reuse. A `resolve` updates that key's last-seen time. Hold it in `Mutex<ActorMap>` on `McpBridge`.

- [ ] **Step 4: Run it.** Expected: PASS.

- [ ] **Step 5: Read identity in `call_tool`.** `client_name(&context)`: `context.peer.peer_info()`, but if the name equals rmcp's own build name (see `transport/streamable_http_server/tower.rs:2415`), read `_meta["io.modelcontextprotocol/clientInfo"]`, then the `User-Agent` from `context.extensions.get::<http::request::Parts>()`, then `"Agent"`. Session comes from the `mcp-session-id` header in `Parts`.

- [ ] **Step 6: Override `on_initialized` to emit `mcp://connected`.** Check its signature in `rmcp-3.7.0/src/handler/server.rs`. If the session or name isn't available there, skip the event: the first call joins the collaborator, and record that in the module README.

- [ ] **Step 7: Rewrite `INSTRUCTIONS`** to say the agent has its own playhead and undo: `preview_*` tools move only its own playhead, `history_undo` reverts only its own steps, `collab_get_user_context` tells where the user is.

- [ ] **Step 8: Verify and commit.** `cargo clippy --all-targets -- -D warnings && cargo test`. Commit `feat(mcp): stable actor keys for connected clients`.

### Task 3: Actors through the bridge and the bus

**Files:**
- Modify: `src/core/command/command.types.ts`, `command.bus.ts`, `src/core/mcp/mcp.types.ts`, `mcp.bridge.ts`, `mcp.tool.ts`, `mcp.registry.ts`, `mcp.transport.tauri.ts`, `src/core/history/history.types.ts`, `history.ts`, `src/core/index.ts`, `src/modules/media/media.mcp.ts`, every hand-written tool
- Test: `src/core/kernel.test.ts`

**Interfaces:**
- Consumes: the `caller` payload from Task 2.
- Produces:

```ts
export type ActorId = string;
export const LOCAL_ACTOR: ActorId = "local";

ExecuteOptions { origin?: CommandOrigin; actor?: ActorId; label?: string }
CommandContext { readonly actor: ActorId }
CommandExecutedEvent { actor: ActorId; changes: StoreChange[] }
HistoryEntry { actor: ActorId }

interface McpCaller { key: ActorId; name: string; version?: string }
McpCall { caller?: McpCaller }
McpToolContext { readonly caller: McpCaller }  // `bus` here is scoped to the caller
McpToolDefinition { readonly readOnly?: boolean }
commandTool(command, { name, description?, writes? })

interface McpCallVerdict { deny?: AppError; label?: string }
interface McpObserver {
  connected(caller: McpCaller): void;
  call(caller: McpCaller, tool: McpToolDefinition): McpCallVerdict;
  /** Text to append to the reply. */
  finished(caller: McpCaller, tool: McpToolDefinition, result: McpToolResult): string[];
}
McpRegistry { observe(observer: McpObserver): () => void; observer(): McpObserver | null }
McpTransport { onConnected(handler: (caller: McpCaller) => void): Promise<() => void> }
```

- [ ] **Step 1: Write the failing tests in `kernel.test.ts`**

```ts
it("records the calling agent on the step", async () => {
  // Bridge with a commandTool; handle({ ..., caller: { key: "agent-1", name: "Claude Code" } })
  expect(kernel.history.getSnapshot().past.at(-1)).toMatchObject({ actor: "agent-1", origin: "agent" });
});

it("a hand-written tool using ctx.bus runs as its caller", async () => {
  // Tool calling ctx.bus.execute(id, input) with no options
  expect(kernel.history.getSnapshot().past.at(-1)?.actor).toBe("agent-1");
});

it("an observer's deny stops the call before the tool runs", async () => {
  // observe({ call: () => ({ deny: { code: "x", message: "no" } }), ... })
  expect(result.isError).toBe(true);
  expect(handlerSpy).not.toHaveBeenCalled();
});

it("appends the observer's notes to the reply", async () => {
  expect(result.content.at(-1)).toEqual({ type: "text", text: "note" });
});

it("a user command defaults to the local actor", async () => {
  expect(kernel.history.getSnapshot().past.at(-1)?.actor).toBe(LOCAL_ACTOR);
});
```

- [ ] **Step 2: Run:** `pnpm vitest run src/core/kernel.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** `actor` defaults to `LOCAL_ACTOR` in `enqueue`. `label` overrides `command.label` when pushing history. In `handle`, a missing `caller` becomes `{ key: "agent", name: "Agent" }`. Build the scoped bus with `{ ...bus, run, execute }` merging `{ origin: "agent", actor: caller.key, label: verdict.label }`. `commandTool` stops passing options; it sets `readOnly: !(command.undoable || options.writes)`. Remove the origin at `media.mcp.ts:29`. Wire `onConnected` in `start`. `observer.finished` runs in `handle` after the tool; a throwing observer is logged and ignored.

- [ ] **Step 4: Mark tools.** `readOnly: true` on hand-written read tools: `history_list`, `project_get_state`, `media_list`, `element_describe`, `junction_describe`, `transition_list_presets`, `fonts_list`, `preview_capture_frame`. Check with `grep -rn "defineMcpTool" src/modules src/core`. Pass `writes: true` to `history_undo` and `history_redo`. List every `undoable: false` command wrapped by `commandTool` and confirm none changes the project.

- [ ] **Step 5: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`. Commit `feat(core): commands and tools know their actor`.

---

## Stage 3: Per-actor undo

### Task 4: Field changes and the project's policy

**Files:**
- Modify: `src/core/store/store.types.ts`, `store.patchable.ts`, `src/core/index.ts`, `src/modules/project/project.store.ts`
- Create: `src/modules/project/logic/fields.ts`
- Test: `src/modules/project/logic/fields.test.ts`, `src/core/kernel.test.ts`

**Interfaces:**
- Produces:

```ts
/** A value of one field across a change. `undefined` means absent. */
interface FieldChange { path: readonly string[]; before: unknown; after: unknown }

interface StorePolicy<T extends object> {
  diff(before: T, after: T): FieldChange[];
  repair(draft: Draft<T>): void;
  /** Why the state is invalid, or null. */
  validate(state: T): string | null;
}

StoreChange { fields?: FieldChange[] }  // set when the store has a policy
createPatchableStore(id, initial, policy?)
PatchableStoreInternal {
  /** Writes `value`s at paths (undefined deletes), repairs and validates. Commits unless invalid; returns the reason. */
  writeFields(writes: Array<{ path: readonly string[]; value: unknown }>): string | null;
  readonly hasPolicy: boolean;
}

// project
export const projectPolicy: StorePolicy<ProjectState>;
```

- [ ] **Step 1: Write the failing tests in `fields.test.ts`**

```ts
it("sees one field in a whole-record replace", () => {
  const after = { ...before, clips: { ...before.clips, c1: { ...before.clips.c1!, start: 5 } } };
  expect(projectPolicy.diff(before, after)).toEqual([{ path: ["clips", "c1", "start"], before: 0, after: 5 }]);
});

it("ignores a replaced record with equal values", () => {
  const after = { ...before, clips: { ...before.clips, c1: { ...before.clips.c1! } } };
  expect(projectPolicy.diff(before, after)).toEqual([]);
});

it("goes one level into plain-object fields", () => {
  // props.size changed, props.text not
  expect(paths(diff)).toEqual([["clips", "c1", "props", "size"]]);
});

it("reports a created entity as one change", () => {
  expect(paths(diff)).toEqual([["clips", "c9"]]);
});

it("never reports ordering arrays", () => {
  // clipIds, trackOrder and mediaOrder changed only
  expect(projectPolicy.diff(before, after)).toEqual([]);
});

it("repair rebuilds clipIds from trackId, sorted by start, and order lists", () => {
  // clip c2 moved to t2 in `clips` only; trackOrder missing t3; contains removed t4
  expect(state.tracks.t2!.clipIds).toEqual(["c3", "c2"]);
  expect(state.trackOrder).toEqual(["t1", "t2", "t3"]);
});

it.each([
  ["a clip on a missing track", withClipOnMissingTrack],
  ["a clip on missing media", withClipOnMissingMedia],
  ["overlapping clips", withOverlap],
  ["a stale junction", withStaleJunction],
  ["two junctions on one cut", withDoubleJunction],
])("validate refuses %s", (_, state) => {
  expect(projectPolicy.validate(state)).not.toBeNull();
});
```

- [ ] **Step 2: Run:** `pnpm vitest run src/modules/project/logic/fields.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `projectPolicy` in `logic/fields.ts`.** `diff` walks `clips`, `tracks`, `junctions`, `media`, `format`, skipping same references. An id on only one side gives `[collection, id]`. For `clips`, `tracks`, `junctions` it compares fields by deep equality, skips `clipIds`, and goes one level into plain objects. `media` compares the whole record as `["media", id]`, per the spec. `validate` uses `findLayoutConflict` and `staleJunctions`.

- [ ] **Step 4: Implement `writeFields` in `store.patchable.ts`** with Immer `produce`: walk each path on the draft, set or delete, call `policy.repair`, then `policy.validate(next)` before `api.setState`. `produce` in the store fills `fields` from `policy.diff(previous, next)`. Pass `projectPolicy` from `project.store.ts`.

- [ ] **Step 5: Run the tests.** Expected: PASS. Then `pnpm test`.

- [ ] **Step 6: Commit** `feat(project): field-level changes and document validation for out-of-order undo`.

### Task 5: The per-actor log

**Files:**
- Modify: `src/core/history/history.ts`, `history.types.ts`
- Create: `src/core/history/history.test.ts`

**Interfaces:**
- Consumes: `StorePolicy`, `FieldChange`, `writeFields` (Task 4).
- Produces:

```ts
History {
  undo(actor?: ActorId): HistoryEntry | null;  // throws CommandFailure("history.conflict", ...)
  redo(actor?: ActorId): HistoryEntry | null;
  /** The label `undo(actor)` would revert. */
  undoLabelOf(actor: ActorId): string | null;
  /** From here on `undo()` means the local actor's steps, not everyone's. */
  scopeUndo(): void;
  /** Hands `from`'s remaining steps to `to` and drops `from`'s redo steps. */
  reassign(from: ActorId, to: ActorId): void;
  /** How refusals name an actor. */
  nameActors(name: (actor: ActorId) => string): void;
}
```

`undo(actor)`: with an actor, that actor's latest step. With no actor, the local actor's when scoped, otherwise the latest of all.

- [ ] **Step 1: Write the failing tests in `history.test.ts`** using a real kernel, the project store and `timeline`-free commands that mutate clips directly.

```ts
it("undoes an agent's older step past the user's newer one", () => { /* agent sets c1.start; user sets c2.start; undo("agent-1") */
  expect(state().clips.c1!.start).toBe(0);
  expect(state().clips.c2!.start).toBe(50);
});

it("refuses when someone changed the same field afterwards, and changes nothing", () => {
  expect(() => history.undo("agent-1")).toThrow(/Can't undo: Someone changed this afterwards/);
  expect(state()).toBe(snapshotBefore);
});

it("a created clip clashes with a later edit of it", () => { /* prefix overlap both ways */ });

it("refuses an undo that leaves a bad document, and rolls back", () => {
  // agent adds track; user moves a clip onto it (only clip.trackId changes); undo("agent-1")
  expect(() => history.undo("agent-1")).toThrow(/Can't undo/);
  expect(state().tracks[newTrackId]).toBeDefined();
});

it("a blocked step blocks that actor's older steps", () => { /* no skipping */ });

it("uses field writes after an out-of-order undo, not stale patches", () => {
  // Review Focus 1. Track with clips [a, b, c] added by user, agent, user.
  // undo("agent-1") removes b. Then undo(LOCAL_ACTOR) removes c.
  expect(state().tracks.t1!.clipIds).toEqual(["a"]);
});

it("an undo with one actor restores order exactly (latest-step path)", () => {
  // removeTrack in the middle, undo: trackOrder is restored in place
  expect(state().trackOrder).toEqual(["t1", "t2", "t3"]);
});

it("refuses a redo when the field changed since", () => { /* Review Focus 2 */ });

it("a step on a store with no policy can't go out of order", () => {
  // Review Focus 3
  expect(() => history.undo("agent-1")).toThrow(/Can't undo/);
});

it("a new edit clears only its own actor's redo", () => {});
```

- [ ] **Step 2: Run:** `pnpm vitest run src/core/history/history.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement in `history.ts`.** One `log: LogEntry[]` of applied steps (`HistoryEntry & { seq: number }`) and `futures: Map<ActorId, UndoneEntry[]>`. Bump a counter for `seq` on every push and every re-apply, so redone steps sit at the log's end.

```ts
// Steps after this seq were written by index-based patches over a reshaped array.
let reshapedAt = 0;

function canUseInversePatches(entry) {
  return entry === log.at(-1) && entry.seq > reshapedAt;
}
```

Out-of-order path: if any change has no `fields`, refuse. Clash: for each later log entry by another actor, any path pair where one is a prefix of the other refuses, naming that entry. Then call `writeFields` with the `before` values, in reverse change order; a returned reason refuses. Success sets `reshapedAt` to the current `seq`.

Redo: inverse-patch path only if nothing was pushed since the undo and the undo itself used patches. Otherwise check clashes against entries with `seq` above the step's `undoneSeq`, then `writeFields` with `after` values.

A `validate` refusal reads `Can't undo: <reason>`. Refusals name the actor through `nameActors`, default "Someone". Trim to `limit` by dropping the oldest log entries. `past` in the snapshot keeps its shape plus `actor`; `canUndo`, `undoLabel` and their redo pair read the local actor when scoped.

- [ ] **Step 4: Run the tests.** Expected: PASS. Then `pnpm test`.

- [ ] **Step 5: Commit** `feat(core): per-actor undo with clash and validity checks`.

### Task 6: History commands and scoping

**Files:**
- Modify: `src/core/history/history.commands.ts`, `history.module.ts`, `src/app/bootstrap.ts`, `src/core/README.md`
- Test: `src/core/kernel.test.ts`

**Interfaces:**
- Consumes: `History` (Task 5).
- Produces: `history.undo`, `history.redo` act for `ctx.actor`. New command `history.undoFor { actor: string }` returning `{ undone, actor }`, with no MCP tool, refusing any caller that isn't `LOCAL_ACTOR`.

- [ ] **Step 1: Write the failing tests**

```ts
it("without scoping, Ctrl+Z reaches an agent's step", async () => { /* Review Focus 5 */ });
it("with scoping, the user's undo skips an agent's step", async () => {});
it("history_undo reverts only the calling agent's steps", async () => {});
it("undoFor reverts another actor's step for the user, and refuses an agent", async () => {});
it("reassign gives a gone agent's steps to the user and drops its redo", () => { /* Review Focus 4 */ });
```

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** `undo` runs `history.undo(ctx.actor === LOCAL_ACTOR ? undefined : ctx.actor)`, and the same for `redo`. `history_list` output gains `actor`. In `bootstrap.ts`, the toast becomes `${name}: ${command.label}`, with `name` from `kernel.history` naming (default `"Agent"`), and refused undos already toast through the failure branch.

- [ ] **Step 4: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`. Update `src/core/README.md`. Commit `feat(core): undo acts for the caller; undoFor`.

---

## Stage 4: Own playhead and capture

### Task 7: A clock per actor

**Files:**
- Create: `src/modules/preview/logic/virtual.clock.ts`
- Modify: `preview.controller.ts`, `preview.commands.ts`, `preview.types.ts`, `preview.module.ts`, `preview.mcp.ts`, `src/modules/preview/README.md`, `src/modules/timeline/timeline.element.command.ts`

**Interfaces:**
- Consumes: `ctx.actor` (Task 3).
- Produces: `createVirtualClock(getDuration: () => Micros, startAt: Micros): PlaybackClock`. `PreviewApi.clockFor(actor: ActorId): PlaybackClock` returns `playback` for `LOCAL_ACTOR`, else a virtual clock created on first use, starting at the user's time. `PreviewApi.dropClock(actor: ActorId): void`.

- [ ] **Step 1: Implement `createVirtualClock`.** `getTime` computes anchor plus elapsed from `performance.now()` while playing, clamped to `getDuration()`; reaching the end stops it. No `requestAnimationFrame`. `onTime` calls the listener immediately and on `seek`, `play`, `pause`.

- [ ] **Step 2: Add `clockFor` and `dropClock`** to the controller.

- [ ] **Step 3: Replace `ctx.require(previewRef).playback` with `.clockFor(ctx.actor)`** in `play`, `pause`, `togglePlay`, `seek`, and in `timeline.addElement` at line 43. Check `grep -rn "playback\.\(getTime\|play\|pause\|seek\)" src/modules --include=\*.commands.ts --include=\*.command.ts`. Keybindings and gestures stay on `playback`.

- [ ] **Step 4: Update tool descriptions** to say "your playhead". `preview_capture_frame` no longer says playback pauses.

- [ ] **Step 5: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`. Manual: with an agent connected, `preview_seek` leaves the user's playhead still. Commit `feat(preview): each actor has its own playhead`.

### Task 8: Offscreen capture

Depends on the Task 1 gate.

**Files:**
- Create: `src/modules/preview/preview.capture.ts`
- Modify: `engine/engine.html.ts`, `engine/engine.types.ts`, `preview.types.ts`, `preview.controller.ts`, `preview.module.ts`, `preview.mcp.ts`, `src/modules/preview/README.md`

**Interfaces:**
- Consumes: `clockFor` (Task 7).
- Produces: `PreviewApi.captureAt(time: Micros): Promise<string>`, replacing `captureFrame`. `PreviewEngine.captureFrame(): Promise<string>`. `EngineOptions.pictureOnly?: boolean`.

- [ ] **Step 1: Make `captureFrame` async** with `canvas.toBlob` and base64 encoding.

- [ ] **Step 2: Add `pictureOnly`** to `HtmlMediaEngine.render`: skip clips on audio tracks.

- [ ] **Step 3: Implement `createCapture(deps): { captureAt(time): Promise<string>; dispose(): void }`.** One lazily created engine on a detached canvas, sized to `project.format` on each capture. Calls run one at a time in a promise chain. Each renders by `setTimeout(30)` until `isSettled()`, with a 3 s limit that throws `Error("The frame did not decode in time")`. Dispose the engine 30 s after the last capture. Register `dispose` with `ctx.onDispose`.

- [ ] **Step 4: Switch `preview_capture_frame`** to `const t = time ?? preview.clockFor(ctx.caller.key).getTime(); preview.clockFor(ctx.caller.key).seek(t)`, then `captureAt(t)`. Remove `captureFrame` from the controller, with the pause and seek it did. Check `grep -rn "captureFrame" src`.

- [ ] **Step 5: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`. Manual: capture while the user plays, with the window minimized, and with an empty timeline (a black frame, not an error). Commit `feat(preview): capture offscreen, independent of the user's preview`.

---

## Stage 5: The `collab` module

### Task 9: Presence, access and context

**Files:**
- Create: `src/modules/collab/{index.ts,collab.ref.ts,collab.module.ts,collab.types.ts,collab.store.ts,collab.observer.ts,collab.commands.ts,collab.mcp.ts,README.md}`, `logic/identify.ts`, `logic/activity.ts`, `logic/prune.ts`
- Modify: `src/app/bootstrap.ts`, `docs/architecture.md`, `CLAUDE.md` (Where to look)

**Interfaces:**
- Consumes: `McpObserver`, `ctx.mcp.observe`, `history.scopeUndo`, `nameActors`, `reassign`, `preview.dropClock`, `TimelineApi.view`.
- Produces:

```ts
type CollaboratorKind = "local" | "agent" | "human";
type CollabAccess = "edit" | "view";
interface Collaborator {
  id: ActorId; kind: CollaboratorKind; name: string; color: string; avatar: string;
  access: CollabAccess; paused: boolean;
  lastSeen: number; running: number; idle: boolean;
  activity: { label: string; status: "running" | "done" | "error" } | null;
  target: CollabTarget | null;
}
type CollabTarget = `clip:${string}` | `media:${string}` | `panel:${string}` | `inspector:${string}`;
interface CollabApi { readonly store: StoreApi<CollabState> }  // { collaborators: Record<ActorId, Collaborator>; blocked: ActorId[]; followed: ActorId | null }
```

Commands (non-undoable, no MCP tools): `collab.setAccess { actor, access }`, `collab.setPaused { actor, paused }`, `collab.setBlocked { actor, blocked }`. Tool: `collab_get_user_context` → `{ time, playing, selection }` (read-only).

- [ ] **Step 1: Create the module** per the new module checklist in `docs/modules.md`: tier `feature`, `requires: ["preview", "timeline", "project"]`, listed in `bootstrap.ts`. The module file is wiring only.

- [ ] **Step 2: `logic/identify.ts`.** `identify(name, others)`: maps client names to a display name and brand colour (`claude` → "Claude Code", `#d97757`; a table for Codex, Cursor, others; else the raw name and a free colour). A second of the same name gets ` 2`.

- [ ] **Step 3: `logic/activity.ts`.** `activityLabel(toolName, "running" | "done")`: a sentence from the tool name, e.g. `timeline_trim_clip` → "Trimming a clip" and "Trim clip".

- [ ] **Step 4: `collab.observer.ts`.** `connected` joins. `call` joins if unknown, then denies in this order: blocked (`collab.disconnected`), paused (`collab.paused`), view access with a tool that isn't `readOnly` (`collab.view_only`), without touching `lastSeen`; otherwise raises `running`, sets activity and returns `{ label: activityLabel(tool, "done") }`. `finished` lowers `running`, sets activity, and returns the queued undo notes. A failed call by an agent calls `notify("error", ...)`. Each `deny` message tells the agent what happened and that the user controls it.

- [ ] **Step 5: Notes.** `bus.onExecuted` for `history.undoFor` queues `The user undid your step "<label>".` for that actor.

- [ ] **Step 6: `logic/prune.ts`.** `prune(collaborators, now)` returns who is idle (2 min) and who is gone (15 min, `running === 0`). A 5 s `setInterval` applies it; gone actors call `history.reassign(id, LOCAL_ACTOR)` and `preview.dropClock(id)` and leave the store. `blocked` stays, since it is kept apart.

- [ ] **Step 7: `setup`** calls `ctx.history.scopeUndo()` and `ctx.history.nameActors`, and registers each cleanup with `ctx.onDispose`.

- [ ] **Step 8: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`. Manual: Pause and View only through a temporary console call give the right errors. Commit `feat(collab): presence, access and the user's context for agents`.

### Task 10: Top bar UI

**Files:**
- Modify: `src/core/shell/shell.points.ts`, `shell.types.ts`, `src/core/index.ts`, `src/app/top-bar/TopBar.tsx`, `src/ui/styles/*` (avatar shape), `CLAUDE.md` (who reads which point; avatars are round)
- Create: `src/modules/collab/ui/{CollabAvatars,CollabPopover,AgentStatusStrip,CollaboratorRow}.tsx`, `src/modules/collab/ui/index.ts`

**Interfaces:**
- Produces: `topBarItems = definePoint<TopBarItem>("shell.topBarItems")`, with `TopBarItem { id: string; slot: "center" | "right"; component: ComponentType }`.

- [ ] **Step 1: Add the point** and read it in `TopBar.tsx` with `usePoint`: each item in an `ErrorBoundary`, `center` after `HistoryControls`, `right` in the empty cell.

- [ ] **Step 2: Build the components from `docs/prototype/`** (`index.html:39-80`, `styles.css` "Collaborators") with semantic tokens, `SegmentedControl` and `Button`. Copy the `claude-spark` SVG. States: idle, editing (ring), off (grey). Agent rows add the "Undo: <label>" button from `history.undoLabelOf(id)`, which runs `history.undoFor`.

- [ ] **Step 3: The strip** shows "<name> is editing" with Stop while `running > 0`; Stop runs `collab.setPaused`. The Disconnect button toggles `collab.setBlocked` and reads Reconnect when blocked. The footer holds the `claude mcp add` snippet from the prototype.

- [ ] **Step 4: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`. Manual: run the "Verification" items for avatars, pause and view only in the spec. Commit `feat(collab): avatars, popover and status strip in the top bar`.

---

## Stage 6: Pointer, playhead, Follow

### Task 11: Agent playhead on the timeline

**Files:**
- Create: `src/modules/timeline/timeline.points.ts`, `src/modules/collab/ui/AgentPlayhead.tsx`
- Modify: `src/modules/timeline/ui/TimelinePanel.tsx`, `timeline.store.ts`, `timeline.types.ts`, `timeline/index.ts`, `src/modules/timeline/README.md`

**Interfaces:**
- Consumes: `preview.clockFor`, `CollabApi.store`.
- Produces: `timelineOverlays` point, items `{ id: string; component: ComponentType }`. `TimelineApi` additions:

```ts
/** The clip's box on screen, or null when no lane shows it. */
clipBox(id: ClipId): { left: number; top: number; right: number; bottom: number } | null;
/** The timeline's box on screen, or null when it isn't shown. */
panelBox(): { left: number; top: number; right: number; bottom: number } | null;
onScroll(listener: () => void): () => void;
scrollToTime(time: Micros): void;
/** The scrolling element, from `TimelinePanel`. */
attachScroller(element: HTMLElement): () => void;
```

- [ ] **Step 1: Add the API.** `clipBox` computes from `laneBoxes()`, `pxPerSecond` and the clip's `start` and `duration`, so it works for clips not on a rendered page, and may return a box outside the panel.

- [ ] **Step 2: Render `timelineOverlays`** beside `<Playhead scrollRef={scrollRef} />` at `TimelinePanel.tsx:155`, outside the virtualized pages.

- [ ] **Step 3: `AgentPlayhead`.** For each agent, a dashed 2px line in its colour, using the same offset as `Playhead.tsx`, and an outline on its target clip. Position by `style` from imperative subscriptions, with no React state on time. Transition 700 ms as in the prototype.

- [ ] **Step 4: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`. Commit `feat(collab): agent playhead on the timeline`.

### Task 12: Arrow pointer

**Files:**
- Create: `src/modules/collab/logic/targets.ts`, `src/modules/collab/ui/AgentPointer.tsx`, `src/modules/collab/ui/pointer.locate.ts`
- Modify: `src/core/shell/shell.points.ts`, `shell.types.ts`, `src/app/layout/LayoutHost.tsx`, `CLAUDE.md`; clip, media card, panel and inspector section elements

**Interfaces:**
- Consumes: `CommandExecutedEvent.changes`, `TimelineApi.clipBox`, `panelBox`, `onScroll`.
- Produces: `appOverlays` point, items `{ id: string; component: ComponentType }`, rendered in a fixed full-window layer with `pointer-events: none`. Attribute `data-collab-target`.

- [ ] **Step 1: Add `data-collab-target`:** `clip:<id>` on `TimelineClip`, `media:<id>` on media cards, `panel:<id>` on each panel and rail button, `inspector:<section>` on inspector sections. No imports.

- [ ] **Step 2: `logic/targets.ts`.** `targetOf(changes, toolName, userSelection): CollabTarget | null`. First changed path wins: `media/*` → `media:<id>`; `clips/<id>/...` → `inspector:<field>` if the clip is in `userSelection` and the field is under `props` or `transform`, else `clip:<id>`; `preview_*` → `panel:preview.panel`; `media_*` → `panel:media.library`; else null, so reads don't move it. Call it from `bus.onExecuted` for `actor !== LOCAL_ACTOR`, and from `finished` for tools with no changes.

- [ ] **Step 3: `pointer.locate.ts`.** `locate(target, timeline): { x, y }`: query `[data-collab-target="..."]`; for a clip, fall back to `clipBox` clamped into `panelBox`; for a missing section or card, fall back to the owning `panel:` element, then its rail button.

- [ ] **Step 4: `AgentPointer`.** An arrow and a name label with the activity sentence, in the agent's colour, per agent. Move with `transform` and a CSS transition. Re-locate on target change, `onScroll`, zoom, and a `ResizeObserver` on the document body. Hide when the agent leaves; dim when idle.

- [ ] **Step 5: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`. Manual: pointer reaches a media card, a clip, an offscreen clip (panel edge), the inspector, the preview. Commit `feat(collab): agent pointer across the app`.

### Task 13: Follow

**Files:**
- Modify: `src/modules/collab/collab.commands.ts`, `collab.module.ts`, `ui/CollabPopover.tsx`, `README.md`
- Create: `src/modules/collab/collab.follow.ts`

**Interfaces:**
- Consumes: `preview.playback`, `preview.clockFor`, `TimelineApi.scrollToTime`.
- Produces: command `collab.follow { actor: string | null }`, non-undoable, no MCP tool.

- [ ] **Step 1: `collab.follow.ts`.** While `followed` is set, each change of the agent's clock sets `expected = time`, calls `playback.seek(time)` and `scrollToTime(time)`. `playback.onTime` compares against `expected`: any other time sets `followed` to null. Include `onPlayingChange` for play.

- [ ] **Step 2: Wire the popover switch**, default off. Label from the prototype: "Follow agent".

- [ ] **Step 3: Full verification.** `pnpm typecheck && pnpm lint && pnpm test`, `cargo clippy --all-targets -- -D warnings && cargo test`, then every manual check in the spec's Verification section, on Linux and Windows.

- [ ] **Step 4: Commit** `feat(collab): follow an agent`.
