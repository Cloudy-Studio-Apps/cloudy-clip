# Module API and Per-Kernel State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Cloudy Clip a plugin-grade module system: typed module refs, tiers, declared
dependencies, extension points and per-kernel state. The app shell builds its UI and shortcuts
from points and imports no module.

**Architecture:** `core/module` gains `definePoint`, `defineModuleRef`, `defineModule` and a host
that sorts modules by `requires`/`uses`/`after`, runs each module's `setup(ctx)` once per
kernel, and hands out its `api` through `require(ref)`. Commands stay static definitions and
reach per-kernel state with `ctx.require(ref)`. Stage 1 (Tasks 1–5) moves every module onto the
new API with no behavior change. Stage 1b (Tasks 6–9) moves the module-level singleton stores and
services into the modules' `setup`, starting with the modules nothing depends on and ending with
`project`.

**Tech Stack:** TypeScript (strict), React 19, Zustand (vanilla stores + `useStore`), Immer
patchable stores, Zod, Vitest (node environment, no DOM).

**Spec:** `docs/superpowers/specs/2026-10-27-modular-cross-platform-architecture-design.md`.
This plan covers stages **1** and **1b**. Stages 2–8 each get their own plan, written once
these interfaces exist.

## Global Constraints

- Every mutation goes through the command bus; non-undoable commands never mutate patchable stores.
- All times are integer microseconds (`Micros`).
- There is no React state on per-frame paths, and Zustand selectors return stable references.
- Every type lives in a `.types.ts` file, except a component's own props type.
- Every exported symbol of a module's `index.ts`, every command and every MCP tool has TSDoc.
- Each module's `README.md` is updated whenever its commands, tools, API or points change.
- Modules import other modules only through `@/modules/<name>`, and the kernel only through `@/core`.
- The app shell (`src/app`) imports no module except to list the built-ins in `bootstrap.ts`.
- A built-in module uses only what a plugin could: refs, `defineModule`, points, `ctx`.
- No module-level singleton holds a service or store when stage 1b ends.
- MCP tool names and behavior stay the same. Command ids stay the same.
- Verify every task with `pnpm typecheck`, `pnpm lint` and `pnpm test`. The app must run (`pnpm tauri dev`) after every task.

## Design decision taken while planning (flag to the user)

The spec describes `register(host)`, `activate(ctx)` and `exports(ctx)` as separate hooks. This
plan merges them into one per-kernel hook, **`setup(ctx) → { api, dispose? }`**:
`ctx.contribute(...)` replaces `register`, the returned `api` replaces `exports(ctx)`, and
`dispose` replaces the disposer `activate` returned. One hook means a module can't contribute
something whose services don't exist yet. Commands and MCP tools stay declarative (static
arrays), so the bus can list them before any `setup` runs.

## Review Focus

1. **React StrictMode mounts effects twice.** Attaching the preview canvas, then detaching it, then attaching it again must leave exactly one live engine and one set of subscriptions. Pinned in Task 7.
2. **A module whose `setup` throws must not leave a panel or keybinding behind.** The UI would otherwise render a component whose services don't exist. Pinned in Task 2.
3. **Undo must still restore state after the stores move into kernels.** An agent edit followed by `history.undo` restores the per-kernel project. Pinned in Task 9.
4. **Two kernels must not share state.** Editing one kernel's project leaves the other's untouched. This is the reason for stage 1b. Pinned in Task 9.
5. **Disposing the kernel must stop work.** After `unloadAll()`, the playback clock is paused and keeps no listeners, and no rAF loop keeps running. Pinned in Task 7.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/core/module/points.ts` (create) | `definePoint`, `createPointRegistry` |
| `src/core/module/points.types.ts` (create) | `Point<T>`, `PointOptions<T>`, `PointRegistry`, `PointReader` |
| `src/core/module/define-module.ts` (create) | `defineModuleRef`, `defineModule` |
| `src/core/module/module.types.ts` (modify) | `ModuleRef`, `ModuleDefinition`, `ModuleContext`, `ModuleSetup`, `ModuleTier`, `ModuleStatus`, `ModuleRegistry` |
| `src/core/module/module-order.ts` (create) | `orderModules`: topological sort + cycle detection |
| `src/core/module/module-registry.ts` (rewrite) | loading, skipping dependents, `require`, contributions, disposal |
| `src/core/command/command.types.ts`, `command-bus.ts` (modify) | `CommandContext.require` |
| `src/core/mcp/mcp.types.ts`, `mcp-bridge.ts` (modify) | `McpToolContext.require` |
| `src/core/history/history.module.ts` (create) | history as a `defineModule` (moves out of `kernel.ts`) |
| `src/core/kernel.ts` (modify) | owns the point registry; wires `require` into the bus and the MCP bridge |
| `src/core/react/kernel-context.tsx` (modify) | `useModule(ref)`, `usePoint(point)` |
| `src/core/shell/shell.points.ts` (create) | `layoutPanels`, `keybindings` points; `matchKeybinding` |
| `src/core/shell/shell.types.ts` (create) | `LayoutPanel`, `LayoutSlot`, `Keybinding`, `KeybindingAction`, `KeyPress` |
| `src/app/LayoutHost.tsx` (create) | renders panels by slot (today's grid) |
| `src/app/keybinding-host.ts` (create) | `installKeybindings(kernel)`; replaces `src/app/shortcuts.ts` (deleted) |
| `src/modules/<m>/<m>.ref.ts` (create, ×4) | `projectRef`, `mediaRef`, `timelineRef`, `previewRef` |
| `src/modules/<m>/<m>.module.ts` (create, ×4) | `defineModule` wiring only |
| `src/modules/<m>/components/` → `src/modules/<m>/ui/` (move, ×3) | React only, with `ui/index.ts` |

---

## Stage 1: module API and points

### Task 1: Extension points

**Files:**
- Create: `src/core/module/points.ts`, `src/core/module/points.types.ts`
- Test: `src/core/module/points.test.ts`
- Modify: `src/core/index.ts` (export `definePoint`, the types)

**Interfaces:**
- Produces:
  - `definePoint<T>(id: string, options?: PointOptions<T>): Point<T>`, where `PointOptions<T> = { keyOf?: (item: T) => string }` and `Point<T>` is `{ readonly id: string; readonly keyOf?: (item: T) => string }` plus a phantom `T`.
  - `createPointRegistry(): PointRegistry`.
  - `PointRegistry` extends `PointReader` with `add<T>(point: Point<T>, moduleId: string, items: readonly T[]): Disposer`.
  - `PointReader` is `{ get<T>(point: Point<T>): readonly T[]; find<T>(point: Point<T>, key: string): T | undefined; subscribe(listener: () => void): () => void }`.

- [ ] **Step 1: Write the failing tests** in `points.test.ts`:
  - `"returns contributions in contribution order"`: two `add` calls, so `get` returns `[a, b, c]`.
  - `"returns the same array until the point changes"`: `get(p) === get(p)` holds. After an `add`, the result is a new array.
  - `"rejects a duplicate key and names both modules"`: with `keyOf: (x) => x.id`, the second `add` with the same id throws a message containing `"panel"`, `"media"` and `"timeline"` (point id, first module, second module).
  - `"find looks up by key"`: `find(p, "x")?.id === "x"`, and a missing key gives `undefined`.
  - `"disposing removes only that contribution"`: dispose the first `add`, so `get` returns only the second module's items.
  - `"notifies subscribers on add and dispose"`: a listener is called once per change.

- [ ] **Step 2: Run** `pnpm vitest run src/core/module/points.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `definePoint` and `createPointRegistry` in `points.ts`. Store entries per point id as `{ moduleId, item }[]`. Cache the `get` array per point and clear the cache on change, which keeps `useSyncExternalStore` stable.

- [ ] **Step 4: Run** the test file. Expected: PASS.

- [ ] **Step 5: Commit**: `git commit -m "feat(core): extension points"`.

### Task 2: Module refs, definition and host

**Files:**
- Create: `src/core/module/define-module.ts`, `src/core/module/module-order.ts`
- Modify: `src/core/module/module.types.ts`
- Rewrite: `src/core/module/module-registry.ts`
- Test: `src/core/module/module-order.test.ts`, `src/core/module/module-registry.test.ts`

**Interfaces:**
- Consumes: Task 1's `PointRegistry`.
- Produces (in `module.types.ts` unless noted):
  ```ts
  type ModuleTier = "core" | "feature";
  type ModuleStatus = "active" | "failed" | "skipped";
  interface ModuleRef<Api> { readonly id: string; readonly __api?: Api } // phantom
  interface ModuleSetup<Api> { api: Api; dispose?: Disposer }
  interface ModuleDefinition<Api = void> {
    readonly ref: ModuleRef<Api>;
    readonly name: string;
    readonly tier?: ModuleTier;          // built-ins set it; plugins leave it unset
    readonly requires?: readonly string[];
    readonly uses?: readonly string[];
    readonly after?: readonly string[];
    readonly commands?: ReadonlyArray<CommandDefinition>;
    readonly mcpTools?: ReadonlyArray<McpToolDefinition>;
    setup?(ctx: ModuleContext): ModuleSetup<Api> | Promise<ModuleSetup<Api>>;
  }
  interface ModuleContext {
    readonly bus: CommandBus; readonly history: History; readonly mcp: McpRegistry;
    readonly log: Logger; readonly points: PointReader;
    require<A>(ref: ModuleRef<A>): A;
    contribute<T>(point: Point<T>, ...items: T[]): void;
  }
  interface ModuleRegistry {
    loadAll(modules: readonly ModuleDefinition<unknown>[]): Promise<Record<string, ModuleStatus>>;
    load(module: ModuleDefinition<unknown>): Promise<ModuleStatus>; // = loadAll([module])
    require<A>(ref: ModuleRef<A>): A;   // unrestricted; throws if not active
    status(id: string): ModuleStatus | undefined;
    unloadAll(): void;
  }
  ```
  - `define-module.ts`: `defineModuleRef<Api>(id: string): ModuleRef<Api>` and `defineModule<Api>(def: ModuleDefinition<Api>): ModuleDefinition<Api>` (identity, for inference). A definition with `Api = void` may omit `setup`, or return `{ api: undefined }`.
  - `module-order.ts`: `orderModules(modules, loadedIds: ReadonlySet<string>): { order: ModuleDefinition<unknown>[]; skipped: Record<string, string> }`. `skipped` maps a module id to its reason. A cycle throws `Error` naming the ids in the cycle.
  - `createModuleRegistry(deps: { bus; history; mcp; points: PointRegistry })`.

- [ ] **Step 1: Write the failing tests** in `module-order.test.ts`:
  - `"orders by requires regardless of input order"`: input `[c(requires b), b(requires a), a]` gives order `[a, b, c]`.
  - `"after only orders and does not require"`: `x(after: ["missing"])` loads, and `missing` is not reported.
  - `"uses must be present but does not order cycles"`: `er(uses db)` with `db` absent gives `skipped.er` mentioning `db`.
  - `"skips modules whose requirement is skipped"`: `a` requires `missing`, `b` requires `a`, so both are skipped.
  - `"throws on a requires cycle and names the modules"`: `a↔b` throws a message containing `a` and `b`.
  - `"already loaded modules satisfy requires"`: `loadedIds = {project}` and `media(requires project)` gives `order = [media]`.

- [ ] **Step 2: Write the failing tests** in `module-registry.test.ts`, building the registry from `createCommandBus`, `createHistory`, `createMcpRegistry` and `createPointRegistry`:
  - `"setup api is returned by require"`: `require(ref).value === 42`.
  - `"ctx.require allows core modules, requires and uses, and itself"`: a feature module may require a `tier: "core"` module without listing it.
  - `"ctx.require rejects an undeclared feature and names both modules"`: the throw is caught, so the module status is `"failed"`.
  - `"a failing setup removes its commands, tools and contributions"`: setup calls `ctx.contribute(panelPoint, x)`, then throws. Afterwards `points.get(panelPoint)` is `[]`, `bus.get(id)` is `undefined` and the status is `"failed"`. *(Review Focus 2)*
  - `"modules requiring a failed module are skipped"`: status `"skipped"`, and its setup is never called.
  - `"commands must be namespaced by the module id"`: keeps the current rule and message.
  - `"unloadAll disposes newest first and removes contributions"`: records the dispose order.
  - `"loadAll reports every status"`: returns `{ a: "active", b: "failed", c: "skipped" }`.

- [ ] **Step 3: Run** both files. Expected: FAIL.

- [ ] **Step 4: Implement** `module-order.ts` (Kahn's algorithm over `requires` + `after` edges, keeping the input order among ready nodes) and the registry. Per module:
  1. register commands and tools (keep today's namespacing checks),
  2. run `setup` with a context whose `contribute` calls `points.add(point, id, items)`,
  3. collect every disposer (commands, tools, contributions, `dispose`) and dispose them in reverse on failure or unload.
  
  `ctx.require` allows the target when it is the module itself, `tier === "core"`, or in `requires`/`uses`. Otherwise it throws `Module "<self>" may not require "<target>": add it to requires or uses`.

- [ ] **Step 5: Run** both files. Expected: PASS. Run `pnpm vitest run src/core` too. `kernel.test.ts` will fail until Task 3. That is expected; note it.

- [ ] **Step 6: Commit**: `git commit -m "feat(core): module refs, dependency ordering and module host"`.

### Task 3: Kernel, command/tool context and React hooks

**Files:**
- Create: `src/core/history/history.module.ts`
- Modify: `src/core/kernel.ts`, `src/core/command/command.types.ts`, `src/core/command/command-bus.ts`, `src/core/mcp/mcp.types.ts`, `src/core/mcp/mcp-bridge.ts`, `src/core/react/kernel-context.tsx`, `src/core/index.ts`, `src/core/kernel.test.ts`, `src/core/README.md`
- Test: `src/core/kernel.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `Kernel` gains `readonly points: PointReader`.
  - `CommandContext` gains `require<A>(ref: ModuleRef<A>): A`. It resolves through `kernel.modules.require`, and a missing module throws `CommandFailure("module.not_loaded", …)`. `createCommandBus` takes a new option `resolveModule: <A>(ref: ModuleRef<A>) => A`.
  - `McpToolContext` gains the same `require`. `createMcpBridge` options gain `modules: Pick<ModuleRegistry, "require">`.
  - `historyRef` and `historyModule` (`tier: "core"`) are created inside `createKernel`, because the history commands close over the kernel's `History`. The module also contributes the undo/redo keybindings once Task 4 exists; add them in Task 4.
  - React hooks: `useModule<A>(ref: ModuleRef<A>): A` and `usePoint<T>(point: Point<T>): readonly T[]` (`useSyncExternalStore(points.subscribe, () => points.get(point))`).

- [ ] **Step 1: Update `kernel.test.ts`** to the new module shape (`defineModule({ ref: defineModuleRef("doc"), … })`). Add:
  - `"commands reach module state through ctx.require"`: a module's `setup` creates a patchable store and returns it as `api`. The command does `ctx.mutate(ctx.require(docRef).store, …)`. Running it through MCP and then undoing restores the state.
  - `"MCP tools can require modules"`: the handler reads `ctx.require(docRef).store.getState()`.

- [ ] **Step 2: Run** `pnpm vitest run src/core/kernel.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the changes listed under Produces. `createKernel` builds the point registry, the registry and the bus. The bus's `resolveModule` is a closure over the registry, created before it. Then `createKernel` loads `historyModule`.

- [ ] **Step 4: Run** `pnpm test`. Expected: the core tests PASS. The module tests fail to compile, because the modules still use the old `ModuleDefinition` (Task 5 fixes this). Run `pnpm typecheck`: errors appear only under `src/modules` and `src/app`.

- [ ] **Step 5: Commit** together with Task 4, because the tree does not typecheck between them. Do not commit yet.

### Task 4: Shell points and hosts

**Files:**
- Create: `src/core/shell/shell.points.ts`, `src/core/shell/shell.types.ts`, `src/app/LayoutHost.tsx`, `src/app/keybinding-host.ts`
- Delete: `src/app/shortcuts.ts`
- Modify: `src/app/App.tsx`, `src/core/index.ts`, `src/core/history/history.module.ts`
- Test: `src/core/shell/shell.points.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type LayoutSlot = "side" | "main" | "bottom";
  interface LayoutPanel { id: string; title: string; slot: LayoutSlot; order?: number; component: ComponentType }
  interface KeyPress { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  interface KeybindingAction { command: string; input: unknown }
  interface Keybinding {
    id: string;              // "<module>.<name>", the key of the point
    key: string;             // KeyboardEvent.key, lowercased
    mod?: boolean;           // Ctrl on Linux/Windows, Cmd on macOS
    shift?: boolean;
    resolve(): KeybindingAction | null; // built at press time; null ignores the press
  }
  const layoutPanels: Point<LayoutPanel>;  // keyOf: id
  const keybindings: Point<Keybinding>;    // keyOf: id
  function matchKeybinding(bindings: readonly Keybinding[], press: KeyPress): Keybinding | undefined;
  ```
  - `installKeybindings(kernel: Kernel): () => void` behaves like today's `installShortcuts`: it ignores repeats and typing in inputs, calls `preventDefault` only when an action resolves, and runs `kernel.bus.execute(action.command, action.input)`.
  - `LayoutHost` renders today's grid exactly, filling `side`, `main` and `bottom` with `usePoint(layoutPanels)` sorted by `order`. Each panel sits inside `<ErrorBoundary name={panel.title}>`.

- [ ] **Step 1: Write the failing tests** in `shell.points.test.ts`:
  - `"matches key, mod and shift exactly"`: `z+mod` matches undo, not redo. `z+mod+shift` matches redo.
  - `"treats metaKey as mod"`: the same binding matches with `metaKey: true`.
  - `"is case-insensitive on key"`: the press `"Z"` matches the binding `"z"`.
  - `"returns undefined when nothing matches"`.

- [ ] **Step 2: Run** it. Expected: FAIL.

- [ ] **Step 3: Implement** the points, `matchKeybinding`, `installKeybindings` and `LayoutHost`. `App.tsx` renders `<LayoutHost />` and installs the keybindings. It imports nothing from `@/modules`. `historyModule` contributes `history.undo` (`z`+mod), `history.redo` (`z`+mod+shift) and `history.redo-y` (`y`+mod).

- [ ] **Step 4: Run** `pnpm vitest run src/core/shell`. Expected: PASS.

### Task 5: Move the four modules onto the new API

**Files:**
- Create per module `<m>` in {project, media, timeline, preview}: `<m>.ref.ts`, `<m>.module.ts`
- Move: `src/modules/{media,timeline,preview}/components/` → `ui/`, each with a `ui/index.ts` exporting its panels and public components
- Modify: each module's `index.ts`, `README.md`; `src/app/bootstrap.ts`; ESLint (`eslint.config.js`) to also forbid `@/modules/<m>/ui/...` deep imports (the existing regex already does; confirm)
- Test: existing tests keep passing

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `projectRef: ModuleRef<void>`, `mediaRef: ModuleRef<void>`, `timelineRef: ModuleRef<void>`, `previewRef: ModuleRef<void>`. The `void` APIs become real types in Tasks 6–9.
  - Module wiring. All four modules are `tier: "core"`:
    - `project`: no requires.
    - `media`: `requires: ["project"]`. It contributes the `media.library` panel to the `side` slot.
    - `preview`: `requires: ["project", "media"]`. It contributes the `preview.panel` panel to `main`, plus keybindings `preview.toggle-play` (`" "`) and `preview.seek-start` (`"home"`).
    - `timeline`: `requires: ["project", "media", "preview"]`. It contributes the `timeline.panel` panel to `bottom`, plus keybindings `timeline.split` (`"s"`) and `timeline.delete` / `timeline.delete-backspace` (`"delete"`, `"backspace"`), each with the same `resolve` logic as today's `shortcuts.ts`.
  - `bootstrap.ts` lists the modules in any order and calls `kernel.modules.loadAll(...)`. It notifies `"<name> failed to load; see the logs."` for `failed`, and `"<name> was skipped: a module it needs did not load."` for `skipped`.
  - Each module's `index.ts` exports its module definition and ref as `<m>Module` and `<m>Ref`, and no longer exports its panel components. The panels reach the app only through points.

- [ ] **Step 1: Do the move.** Keep the singleton stores and services exactly as they are. Each module's existing `activate` body moves into `setup(ctx)`, which returns `{ api: undefined, dispose }`.

- [ ] **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all PASS.

- [ ] **Step 3: Check the app by hand** with `pnpm tauri dev`. Import a file, drag it to the timeline, play, split with `s`, delete, undo with Ctrl+Z, seek with Home, and call `project_get` over MCP. Everything behaves as before.

- [ ] **Step 4: Commit** Tasks 3–5: `git commit -m "refactor: modules on defineModule; app shell built from layout and keybinding points"`.

---

## Stage 1b: per-kernel state (leaves first, `project` last)

Each task below follows the same steps:
1. Create the stores and services inside `setup` and return them as the module's `api`.
2. Make commands and tools use `ctx.require(<ref>)`.
3. Make UI components use `useModule(<ref>)` with `useStore(api.someStore, selector)`.
4. Make non-React helpers take what they need as parameters.
5. Delete the module-level instance and stop exporting it from `index.ts`.
6. Run `pnpm typecheck && pnpm lint && pnpm test`, check the app by hand as in Task 5 Step 3, and commit.

### Task 6: Timeline view state per kernel

**Files:** `src/modules/timeline/timeline.store.ts` (it becomes `createTimelineView()`), `timeline.ref.ts`, `timeline.module.ts`, `timeline.types.ts`, `ui/*` (Toolbar, TimelinePanel, TimelineClip, TrackLane, `clip-gesture.ts`), `index.ts`, `README.md`
**Test:** `src/modules/timeline/timeline.view.test.ts`

**Interfaces:**
- Produces: `TimelineApi`, defined in `timeline.types.ts`:
  ```ts
  interface TimelineApi {
    readonly view: StoreApi<TimelineViewState>;
    setZoom(pxPerSecond: number): void;           // clamped to [MIN_PX_PER_SECOND, MAX_PX_PER_SECOND] = [2, 400]
    selectClip(id: ClipId | null, additive?: boolean): void;
  }
  ```
  `timelineRef: ModuleRef<TimelineApi>`. `startClipGesture` options gain `view: StoreApi<TimelineViewState>`. Today's selection-pruning subscription moves into `setup`. The timeline keybindings read `api.view` through the closure.

- [ ] **Step 1: Write the failing tests** in `timeline.view.test.ts`, covering `createTimelineView()`:
  - `"clamps zoom to 2..400"`: `setZoom(1)` gives 2, and `setZoom(1000)` gives 400.
  - `"selectClip replaces, toggles with additive, and clears with null"`.
  - `"two views are independent"`.
- [ ] **Step 2: Run** it. Expected: FAIL. **Step 3: Implement.** **Step 4: Run** it plus the full suite. Expected: PASS. **Step 5: Check by hand, then commit**: `refactor(timeline): view state per kernel`.

### Task 7: Preview clock and controller per kernel

**Files:** `src/modules/preview/preview.controller.ts` (it becomes `createPreviewController(deps)`), `preview.commands.ts`, `preview.mcp.ts`, `preview.types.ts`, `preview.module.ts`, `ui/PreviewPanel.tsx`, `ui/Transport.tsx`, the timeline's `ui/*` that use `playback`, `index.ts`, `README.md`
**Test:** `src/modules/preview/preview.controller.test.ts`

**Interfaces:**
- Consumes: `projectStore` and media's `mediaUrl`/`mediaProbeStore` (still singletons; Tasks 8–9 replace them through `deps`).
- Produces:
  ```ts
  interface PreviewControllerDeps {
    clock: PlaybackClock;
    getProject(): ProjectState;
    subscribeProject(listener: () => void): () => void;
    subscribeMedia(listener: () => void): () => void;
    createEngine(canvas: HTMLCanvasElement, onFrameReady: () => void): PreviewEngine;
    requestFrame(cb: () => void): void;   // requestAnimationFrame in the app, a manual queue in tests
  }
  interface PreviewApi {
    readonly playback: PlaybackClock;
    attachCanvas(canvas: HTMLCanvasElement): () => void;
    redraw(): void;
    captureFrame(time?: Micros): Promise<string>;
  }
  function createPreviewController(deps: PreviewControllerDeps): PreviewApi & { dispose(): void };
  ```
  `previewRef: ModuleRef<PreviewApi>`. Preview commands and tools use `ctx.require(previewRef).playback`. The timeline reads `useModule(previewRef).playback`, and `startClipGesture` takes `playback` as an option.

- [ ] **Step 1: Write the failing tests**, using a fake engine (it counts `render` and `dispose` calls and has a settable `isSettled`) and a fake clock (`createPlaybackClock` with a manual `requestFrame`):
  - `"attach, detach, attach leaves one live engine"`: the first engine's `dispose` is called, the second isn't, and one project change triggers renders only on the second. *(Review Focus 1)*
  - `"retries while unsettled when paused, at most 180 times"`.
  - `"dispose pauses the clock and drops every subscription"`: after `dispose()`, `clock.isPlaying()` is false, and project and media notifications cause no render. *(Review Focus 5)*
  - `"captureFrame rejects when no canvas is attached"` with `"The preview is not visible"`.
- [ ] **Step 2: Run** it. Expected: FAIL. **Step 3: Implement**, wiring the controller in `preview.module.ts`'s `setup` and calling `dispose` from the module's `dispose`. **Step 4: Run** it plus the full suite. Expected: PASS. **Step 5: Check by hand** (play, scrub, capture a frame over MCP, and toggle StrictMode reloads with HMR), then commit: `refactor(preview): clock and controller per kernel`.

### Task 8: Media stores and services per kernel

**Files:** `src/modules/media/media.store.ts` (it becomes `createMediaState()`), `media.service.ts` (it becomes `createMediaService()`, owning `baseUrl`), `media.probe.ts` (it becomes `createProbeQueue(deps)`, keeping concurrency 2), `media.commands.ts`, `media.mcp.ts`, `media.types.ts`, `media.module.ts`, `ui/*`, preview's `deps` wiring, timeline's `timeline.commands.ts` and `ui/*`, `index.ts`, `README.md`
**Test:** `src/modules/media/media.state.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface MediaApi {
    readonly probes: StoreApi<MediaProbeState>;
    readonly fileDrop: StoreApi<{ active: boolean }>;
    getProbe(id: MediaId): MediaProbe | undefined;
    waitForProbe(id: MediaId, timeoutMs?: number): Promise<MediaProbe | undefined>; // default 15_000
    mediaUrl(id: MediaId): string;
  }
  ```
  `mediaRef: ModuleRef<MediaApi>`. The timeline's `mediaDuration` becomes `mediaDuration(media: MediaApi, mediaId)` and is called with `ctx.require(mediaRef)`. Preview's `createEngine`/`subscribeMedia` deps read the `MediaApi`.
- Test helper: `src/modules/media/media.testing.ts` exports `createFakeMediaModule(probes: Record<MediaId, MediaProbe>): ModuleDefinition<MediaApi>`. It uses the same `mediaRef` with no native calls, and its `mediaUrl` returns `"fake://<id>"`. Export it from `media/index.ts` with TSDoc stating it is for tests.

- [ ] **Step 1: Write the failing tests** in `media.state.test.ts`:
  - `"setProxy keeps the earlier message when progress omits it"`.
  - `"waitForProbe resolves on ready and on timeout"` (fake timers).
  - `"two media states are independent"`.
- [ ] **Step 2: Update `timeline.commands.test.ts`** to build a kernel with `loadAll([projectModule, createFakeMediaModule({ mv: …, ma: … }), previewModule, timelineModule])` (the same probes as today's `beforeEach`; preview's setup must not touch `requestAnimationFrame` until a canvas is attached, so it loads in node). Until Task 9 the project is still a singleton, so `resetProject` stays here. Expected: FAIL now, PASS after Step 4.
- [ ] **Step 3: Implement.** **Step 4: Run** the full suite. Expected: PASS. **Step 5: Check by hand** (import a ProRes file and watch the proxy progress, drop a file from the OS, check the poster appears), then commit: `refactor(media): probe state and media service per kernel`.

### Task 9: Project document per kernel

**Files:** `src/modules/project/project.store.ts` (`createProjectStore()`; `resetProject` deleted), `project.commands.ts`, `project.mcp.ts`, `project.types.ts`, `project.module.ts`, and every remaining `projectStore` user (`grep -rn projectStore src` must return nothing at the end), `index.ts`, `README.md`, all module tests
**Test:** `src/modules/project/project.kernel.test.ts`

**Interfaces:**
- Produces: `interface ProjectApi { readonly store: PatchableStore<ProjectState> }` and `projectRef: ModuleRef<ProjectApi>`. Commands use `ctx.mutate(ctx.require(projectRef).store, …)`. Preview's deps `getProject`/`subscribeProject` read it. Tests seed state without a command: `project.module.ts` exports `createProjectModule(initial?: ProjectState): ModuleDefinition<ProjectApi>`, with `projectModule = createProjectModule()` for the app, and tests pass a prepared `ProjectState`. (`reset` is on the concrete store only, not on `PatchableStore`, so seeding happens at creation.)

- [ ] **Step 1: Write the failing tests** in `project.kernel.test.ts`:
  - `"two kernels have independent projects"`: `project.setFormat` with `16:9` on kernel A leaves kernel B at 9:16 (1080×1920). *(Review Focus 4)*
  - `"undo restores an agent's edit on the kernel's own project"`: run `project.setFormat` with origin `"agent"`, then `history.undo`, and the format is back to 1080×1920. *(Review Focus 3)*
- [ ] **Step 2: Run** it. Expected: FAIL. **Step 3: Implement**, then migrate every remaining user. **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS. Also run `grep -rnE "^export const \w+(Store|playback)\b" src/modules`, which must return nothing.
- [ ] **Step 5: Check the whole app by hand** (Task 5 Step 3's list plus MCP `timeline_add_clip`, `history_undo` and `preview_capture_frame`), then commit: `refactor(project): document store per kernel`.

### Task 10: Docs

**Files:** `CLAUDE.md` (Architecture rules §1: module anatomy with `.ref.ts`, `.module.ts`, `ui/`, tiers, `requires`, points, `setup`/`api`, "what is not a module"; §2: `ctx.require` instead of importing stores; "Current state"), `docs/architecture.md`, `src/core/README.md` (points, module host, hooks), every module `README.md` (API, contributed panels, keybindings, points it owns)

- [ ] **Step 1: Update the docs** listed above, keeping each module's README in the existing template.
- [ ] **Step 2: Run** `pnpm lint` (Prettier covers Markdown). Expected: PASS.
- [ ] **Step 3: Commit**: `docs: module API, points and per-kernel state`.
