# Compositions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A project holds several compositions, each with its own settings, tracks and clips, kept in a Library tab and placeable inside one another as live mirrors.

**Architecture:** Tracks, clips and junctions stay in the flat records of `ProjectState`; a `Track` gains `compositionId`, and `format` and `trackOrder` move onto `Composition`. A new optional `StorePolicy.settle` keeps derived facts true inside every step. A new core module `composition` sits above `timeline`, `preview` and `media`; lower modules read the per-actor open composition from `project`.

**Tech Stack:** TypeScript (strict), React 19, Zustand, Immer, Zod, Vitest, Tauri 2 (Rust).

**Spec:** `docs/superpowers/specs/2026-10-30-compositions-design.md`. Read it first; it holds the behaviour. This plan holds the file-level decisions.

## Global Constraints

- All rules in `CLAUDE.md` apply. Each task ends with `pnpm typecheck`, `pnpm lint` and `pnpm test` passing; Rust changes also pass `cargo clippy --all-targets -- -D warnings` and `cargo test` in `src-tauri`.
- Tests only where rule 3 allows: the kernel, document integrity, undoable commands. No UI tests (the environment has no DOM).
- Update the `README.md` of every module whose commands, tools, points or files change, in the same task.
- Times are integer `Micros`. Width and height are integers from 2 to 8192. Default background `#000000`, default duration 10 s, default fps of an unknown file 30.
- 29.97 is stored as `30000 / 1001`, 23.976 as `24000 / 1001`, 59.94 as `60000 / 1001`.
- Error codes, exactly: `composition.none_open`, `composition.cycle`, `composition.in_use`, `composition.main`, `composition.group_blocked`, `composition.invalid_size`, `composition.no_picture`, `composition.not_placed`, `media.not_ready`.
- Commit messages carry no `Co-Authored-By` line.
- `master` moves: stickers landed while this was written. Rebase on it before starting and re-run the greps in Task 2.

## Review Focus

- **Undoing the composition someone has open:** an actor on a composition that an undo removes lands on Main, then on none, with no crash in the timeline or preview. Test in Task 3.
- **Two collaborators in one Extend to fit composition:** each can undo their own step out of order, with no `history.conflict` over `duration`. Test in Task 2.
- **Actions that used to walk "everything":** split with no selection, snapping, track naming, and `soundGains` must see only one composition; a clip in another composition is never split or snapped to. Tests in Task 2.
- **The same composition twice at once:** two overlapping placements on different tracks at different local times both play and both draw. Test in Task 10.
- **Files used only by a closed composition:** `media.remove` still refuses, and deleting a composition frees them. Test in Task 3.

---

## Phase 1: Foundation

### Task 1: The settle step in the kernel

**Files:**

- Modify: `src/core/store/store.types.ts`, `src/core/store/store.patchable.ts`, `src/core/README.md`
- Test: `src/core/store/store.patchable.test.ts` (new)
- Also add: `docs/superpowers/specs/2026-10-30-compositions-design.md`, this plan

**Interfaces:**

- Produces: `StorePolicy<T>.settle?(draft: Draft<T>): void`.

- [ ] **Step 1: Write the failing tests**

```ts
it("makes what settle writes part of the step, and undoes it with the step", () => {
  const store = createPatchableStore("t", { a: 1, double: 2 }, policy); // settle: double = a * 2
  const change = store.produce((d) => {
    d.a = 5;
  })!;
  expect(store.getState().double).toBe(10);
  store.apply(change.inversePatches);
  expect(store.getState()).toEqual({ a: 1, double: 2 });
});
it("settles after writeFields, before validate", () => {
  store.writeFields([{ path: ["a"], value: 7 }]);
  expect(store.getState().double).toBe(14);
});
it("records no change when the recipe changes nothing", () => {
  expect(store.produce(() => {})).toBeNull();
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/core/store/store.patchable.test.ts`. Expected: FAIL, `double` is not updated.
- [ ] **Step 3: Implement.** In `produce`, wrap the recipe so `policy?.settle?.(draft)` runs after it, inside `produceWithPatches`. In `writeFields`, call it after `policy.repair(draft)`. Add the TSDoc: derived consequences that must hold after every change, can't fail, must not depend on anything outside the state.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat(core): let a store settle derived values inside a step`, with the spec and this plan.

### Task 2: The data move

The big mechanical one. It must stay green, so until Task 5 `createEmptyProject()` still seeds one composition named "Main" with the two tracks, and `FORMAT_PRESETS` stays in `project`.

**Files:**

- Modify: `src/modules/project/project.types.ts`, `project.store.ts`, `project.selectors.ts`, `project.module.ts`, `project.ref.ts`, `project.mcp.ts`, `project.commands.ts`, `index.ts`, `logic/fields.ts`, `logic/junctions.ts`, `README.md`
- Create: `src/modules/project/project.view.ts`, `src/modules/project/logic/compositions.ts`, `src/modules/project/project.testing.ts`
- Modify (readers, table below) and every test fixture
- Test: `src/modules/project/logic/compositions.test.ts`, additions to `fields.test.ts`, `project.undo.test.ts`, `timeline.commands.test.ts`

**Interfaces:**

- Produces in `project.types.ts`: `CompositionId`, `Composition { id, name, format, background, duration, extendToFit, trackOrder }`, `ProjectState { compositions, compositionOrder, mainCompositionId, media, mediaOrder, tracks, clips, junctions }`, `Track.compositionId`, `Clip.compositionRef?`. `ProjectFormat` is unchanged.
- Produces in `logic/compositions.ts` / `project.selectors.ts`:
  - `compositionOf(state, track: Track): Composition`
  - `formatOfTrack(state, trackId: TrackId): ProjectFormat`
  - `formatOf(state, clip: Clip): ProjectFormat`
  - `frameDuration(format: ProjectFormat): Micros` (`Math.ceil(1_000_000 / fps)`, replaces the five inline copies)
  - `orderedTracks(state, compositionId: CompositionId): Track[]`
  - `compositionClips(state, compositionId): Clip[]`
  - `compositionContent(state, compositionId): Micros` (the end of the last clip)
  - `placementsOf(state, compositionId): Clip[]`
  - `contains(state, outer: CompositionId, inner: CompositionId): boolean` (true when equal, or at any depth)
  - `settleCompositions(draft: Draft<ProjectState>): void` (this task: Extend to fit only)
- Produces in `project.view.ts`: `createCompositionView(store): CompositionView`, on `ProjectApi.view`:
  - `store: StoreApi<{ open: Record<ActorId, CompositionId | null>; tabs: CompositionId[] }>`
  - `openFor(actor: ActorId): CompositionId | null` (unset falls back to Main; `null` means the actor closed everything)
  - `setOpen(actor, id: CompositionId | null): void` (for `LOCAL_ACTOR` it also adds a tab)
  - `closeTab(id): void` (opens the neighbouring tab, or `null`)
  - `requireOpen(actor): Composition` (throws `CommandFailure("composition.none_open", …)`)
  - On each document change, an actor whose composition is gone moves to Main, then `null`; missing tabs are dropped.
- Produces in `project.testing.ts`: `seedProject(overrides?: { format?, tracks?, clips?, junctions?, media? }): ProjectState`: one composition `c1` holding the given tracks, for all test fixtures.
- `projectDuration` is removed. `isMediaInUse` stays as it is: it already walks every clip.

**Reader changes.** Before starting, re-run the greps in the Spec's Data section, as files may have moved.

| Change                                       | Where                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Use `formatOf(state, clip)`                  | `element.commands.ts:90,91,113,117`, `transform/logic/layers.ts:48,52`, `inspector/ui/props.live.hook.ts:27`                                                                                                                                                                                                                                                                                                             |
| Use `formatOfTrack(state, junction.trackId)` | `junction.guards.ts:67,139,142`, `junction.commands.ts:126`, `inspector/ui/junction.live.hook.ts:24`, `timeline/junction.display.ts:21,35`, `transition.apply.command.ts:30`                                                                                                                                                                                                                                             |
| Use the open composition's format            | `inspector/ui/ElementPanel.tsx:19`, `JunctionView.tsx:25`, `ProjectView.tsx:13`, `text/ui/TextEditor.tsx:31`, `preview/ui/stage.layout.hook.ts:21`, `transform/ui/TransformOverlay.tsx:29`, `transition/ui/thumbnail.hook.ts:42`, `TransitionOptionsControl.tsx:25`, `timeline/ui/CreateTiles.tsx:32`, `element.mcp.ts:16`, `junction.mcp.ts:32`; `useOpenComposition()` hook in `project`, selecting a stable reference |
| Take a `format` argument                     | `timeline/logic/placement.ts:17` `minClipDuration(format)`; `freeTrack` (`:74`) takes the `Composition`; the junction kind's `overlap.min(state)` becomes `min(format: ProjectFormat)` (`junction.types.ts:17`, `junction/logic/limits.ts:14` passes `formatOf(state, left)`, `transition.kind.ts:25`)                                                                                                                   |
| Scope to one composition                     | `timeline.split.commands.ts:38` (open composition), `placement.ts:208,212` `snapCandidates(state, compositionId, playhead)`, `timeline.track.commands.ts:14` (count in the composition), `:37,38,63` (the composition's `trackOrder`), `timeline.clip.commands.ts:82` and its new-track path, `preview/logic/junctions.ts:12,36`, `project/logic/junctions.ts:39`                                                        |
| Walk `Object.values(state.tracks)` instead   | `project/logic/junctions.ts:115` (`findLayoutConflict`)                                                                                                                                                                                                                                                                                                                                                                  |

`preview` and `timeline` panels read the open composition here too, but their fuller treatment is Task 4: in this task `engine.render` takes `composition: Composition` as a new argument and draws its `trackOrder`, and `duration` becomes `composition.duration`.

- [ ] **Step 1: Write the failing tests**

```ts
// logic/compositions.test.ts
it("finds a composition at any depth", () => {
  expect(contains(nested, "outer", "inner")).toBe(true);
  expect(contains(nested, "inner", "outer")).toBe(false);
  expect(contains(nested, "outer", "outer")).toBe(true);
});
it("follows the last clip while Extend to fit is on, and is one frame when empty", () => {
  expect(settled(withClipEndingAt(5_000_000)).compositions.c1!.duration).toBe(5_000_000);
  expect(settled(empty).compositions.c1!.duration).toBe(frameDuration(format));
});
it("leaves a fixed length alone", () => {
  expect(settled(fixedAt(9_000_000)).compositions.c1!.duration).toBe(9_000_000);
});

// logic/fields.test.ts
it("does not report the derived duration of an Extend to fit composition", () => {
  expect(paths(withDuration(5)).some((p) => p[0] === "compositions")).toBe(false);
});
it("refuses a track without its composition, a clip without its compositionRef, a cycle, and no Main", () => {
  expect(projectPolicy.validate(orphanTrack)).toMatch(/composition/);
  expect(projectPolicy.validate(danglingRef)).toMatch(/composition/);
  expect(projectPolicy.validate(cycle)).toMatch(/inside itself/);
  expect(projectPolicy.validate(noMain)).toMatch(/main/i);
});

// project.undo.test.ts
it("lets two actors undo their own edits out of order in an Extend to fit composition", () => {
  run(LOCAL_ACTOR, moveClip("a"));
  run(AGENT, moveClip("b"));
  expect(() => kernel.history.undo(LOCAL_ACTOR)).not.toThrow();
  expect(state().compositions.c1!.duration).toBe(compositionContent(state(), "c1"));
});

// logic/compositions.test.ts (the view)
it("refuses with composition.none_open when an actor closed everything", () => {
  view.setOpen(LOCAL_ACTOR, null);
  expect(() => view.requireOpen(LOCAL_ACTOR)).toThrow(/none_open/);
});

// timeline.commands.test.ts
it("splits only the open composition when no clips are named", async () => {
  await run(splitAt, { at: 1_000_000 });
  expect(clipsOf("c2")).toHaveLength(1);
});
it("snaps only to clips of the composition", () => {
  expect(snapCandidates(two, "c1", 0)).not.toContain(startOfClipInC2);
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/modules/project`. Expected: FAIL (missing exports).
- [ ] **Step 3: Implement the types, store, selectors and `seedProject`.** `format` and `trackOrder` leave `ProjectState`. `createEmptyProject()` seeds composition "Main" for now: 9:16, background `#000000`, duration 10 s, `extendToFit: true`.
- [ ] **Step 4: Implement the policy** in `logic/fields.ts`. `RECORDS` gains `compositions`, compared at field level; `format` diff goes. `diff` skips `duration` of a composition whose `extendToFit` is on in both states. `repair` rebuilds each composition's `trackOrder` from tracks with its id, and `compositionOrder`. `validate` adds the four checks. `settle: settleCompositions`.
- [ ] **Step 5: Implement `project.view.ts`** and expose it on `ProjectApi` in `project.module.ts`.
- [ ] **Step 6: Update every reader** in the table, and move all fixtures to `seedProject`.
- [ ] **Step 7: Update `project_get_state`.** Returns `{ main, compositions: [{ id, name, format, background, duration, extendToFit, tracks: [...clips inline], junctions }], media }`. Keep `project.setFormat` working on the open composition until Task 3.
- [ ] **Step 8: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass, the app behaves as before.
- [ ] **Step 9: Commit** `refactor(project): give tracks a composition`.

### Task 3: The `composition` module and its commands

**Files:**

- Create: `src/modules/composition/` with `index.ts`, `composition.ref.ts`, `composition.module.ts`, `composition.types.ts`, `composition.commands.ts`, `composition.guards.ts`, `composition.presets.ts`, `composition.mcp.ts`, `README.md`
- Modify: `src/app/bootstrap.ts`, `src/modules/project/project.commands.ts` (delete), `project.mcp.ts`, `project.store.ts`, `project/README.md`, `docs/modules.md`
- Test: `src/modules/composition/composition.commands.test.ts`

**Interfaces:**

- Consumes: Task 2's selectors and `ProjectApi.view`.
- Produces in `composition.presets.ts`: `COMPOSITION_PRESETS: Record<PresetId, ProjectFormat>`, ids `"9:16"`, `"16:9"`, `"1:1"`, `"4:5"`, `"4k-16:9"`, `"4k-9:16"`; `FPS_OPTIONS`. `formatPreset` moves here. Sizes: 1080×1920, 1920×1080, 1080×1080, 1080×1350, 3840×2160, 2160×3840, all 30 fps.
- Produces commands (all `input` in Zod, TSDoc on each), tools as in the Spec's table:
  - `createComposition { name?, format?, background?, duration?, extendToFit? } → { compositionId }`
  - `setSettings { compositionId, name?, format?, background?, duration?, extendToFit? }` (dragging the end marker later passes `duration` with `extendToFit: false`)
  - `setMain { compositionId }`, `duplicateComposition { compositionId } → { compositionId }`, `deleteComposition { compositionId }`, `extendToFitOnce { compositionId }`
  - `openComposition { compositionId }`, `closeTab { compositionId }`, not undoable
- Module: `tier: "core"`, `requires: ["project", "element", "media", "timeline", "preview"]`; list only what is used at each stage, and add the rest when the task that needs them lands.

- [ ] **Step 1: Write the failing tests**

```ts
it("makes the first composition Main, with one video and one audio track, and opens it", async () => {
  const { compositionId } = await ok(createComposition, {});
  expect(state().mainCompositionId).toBe(compositionId);
  expect(orderedTracks(state(), compositionId).map((t) => t.kind)).toEqual(["video", "audio"]);
  expect(view.openFor(LOCAL_ACTOR)).toBe(compositionId);
});
it("opens an agent's new composition for the user only when the user has nothing open", async () => {
  view.setOpen(LOCAL_ACTOR, null);
  const { compositionId } = await ok(createComposition, {}, { actor: AGENT });
  expect(view.openFor(LOCAL_ACTOR)).toBe(compositionId);
  const second = await ok(createComposition, {}, { actor: AGENT });
  expect(view.openFor(LOCAL_ACTOR)).toBe(compositionId);
  expect(view.openFor(AGENT)).toBe(second.compositionId);
});
it("moves an actor off a composition an undo removes", async () => {
  await ok(createComposition, {}); // Main
  const { compositionId } = await ok(createComposition, {});
  kernel.history.undo(LOCAL_ACTOR);
  expect(view.openFor(LOCAL_ACTOR)).toBe(state().mainCompositionId);
  expect(state().compositions[compositionId]).toBeUndefined();
});
it("refuses to delete Main while others exist, and frees the project when it is the last", async () => {
  expect(await failure(deleteComposition, { compositionId: main })).toBe("composition.main");
  await ok(deleteComposition, { compositionId: other });
  await ok(deleteComposition, { compositionId: main });
  expect(state().mainCompositionId).toBeNull();
  expect(state().tracks).toEqual({});
});
it("deleting a composition removes its tracks, clips and junctions, and frees its media", async () => {
  expect(await failure(removeMedia, { mediaId })).toBe("media.in_use");
  await ok(deleteComposition, { compositionId: closed });
  await ok(removeMedia, { mediaId });
});
it("duplicates tracks, clips, links and junctions with new ids", async () => {
  const { compositionId } = await ok(duplicateComposition, { compositionId: c1 });
  expect(clipsOf(compositionId)).toHaveLength(clipsOf(c1).length);
  expect(idsOf(compositionId)).not.toEqual(expect.arrayContaining(idsOf(c1)));
});
it("rejects a size outside 2..8192", async () => {
  expect(
    await failure(setSettings, { compositionId, format: { width: 1, height: 10, fps: 30 } }),
  ).toBe("composition.invalid_size");
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/modules/composition`. Expected: FAIL.
- [ ] **Step 3: Implement the module, commands and tools.** Delete `project.setFormat`, `project_set_format`, `FORMAT_PRESETS`. Add the module to `MODULES` and to the tier table of `docs/modules.md`.
- [ ] **Step 4: Move the callers.** `FormatPicker` now runs `setSettings` on the open composition; it goes in Task 5.
- [ ] **Step 5: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 6: Commit** `feat(composition): create, set up and delete compositions`.

### Task 4: Preview and timeline follow the open composition

**Files:**

- Modify: `src/modules/preview/preview.module.ts`, `preview.controller.ts`, `preview.capture.ts`, `preview.commands.ts`, `preview.types.ts`, `engine/engine.html.ts`, `README.md`
- Modify: `src/modules/timeline/timeline.store.ts`, `timeline.module.ts`, `ui/TimelinePanel.tsx`, `README.md`
- Create: `src/modules/preview/logic/playheads.ts`
- Test: `src/modules/preview/logic/playheads.test.ts`

**Interfaces:**

- Consumes: `ProjectApi.view`.
- Produces: `PreviewEngine.render(project, composition, time, playing, transforms?, propsOverrides?)`; `PreviewApi.captureAt(time, compositionId?)`; `rememberPlayheads(): { switchTo(from: CompositionId | null, to: CompositionId | null, time: Micros): Micros }` in `logic/playheads.ts`.

Decisions: `draw` fills `composition.background` where it now fills `#000`. `clock` length is `composition.duration`, and playback stops there. On a switch, the user's clock stores its time in a `Map<CompositionId, Micros>` and seeks to the stored time of the next one; `dropClock` keeps working for agents. `timeline.view` keeps `pxPerSecond` and scroll per composition in a `Map`, and clears the selection on a switch. `preview.play`, `preview.seek` and `preview_capture_frame` use `view.requireOpen(ctx.actor)`.

- [ ] **Step 1: Write the failing tests**

```ts
it("remembers the playhead of each composition", () => {
  const playheads = rememberPlayheads();
  expect(playheads.switchTo("c1", "c2", 2_000_000)).toBe(0);
  expect(playheads.switchTo("c2", "c1", 500_000)).toBe(2_000_000);
  expect(playheads.switchTo("c1", "c2", 2_000_000)).toBe(500_000);
});
```

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** per the decisions above.
- [ ] **Step 4: Check by hand.** `pnpm tauri dev`; with an agent, `composition_create`, `composition_open`, confirm the user's view stays put and `preview_capture_frame` shows the agent's composition.
- [ ] **Step 5: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 6: Commit** `feat(preview): play the composition each actor has open`.

### Task 5: Dialog, Library, tabs and the empty start

**Files:**

- Create: `src/ui/kit/ContextMenu.tsx`, `src/ui/kit/Dialog.tsx`
- Create: `src/modules/media/media.points.ts`
- Create: `src/modules/composition/ui/CompositionDialog.tsx`, `CompositionSection.tsx`, `CompositionTile.tsx`, `CompositionTabs.tsx`, `EmptyStart.tsx`, `ui/index.ts`, `composition.store.ts`
- Modify: `src/ui/index.ts`, `src/ui/README.md`, `src/modules/media/media.module.ts`, `ui/MediaLibrary.tsx`, `src/modules/timeline/timeline.points.ts`, `ui/TimelinePanel.tsx`, `src/modules/project/project.store.ts`, `src/modules/preview/ui/Transport.tsx`, delete `ui/FormatPicker.tsx`, `src/modules/inspector/ui/ProjectView.tsx`, `src-tauri/src/mcp/server.rs`, `CLAUDE.md`, READMEs

**Interfaces:**

- Produces: point `librarySections` in `media.points.ts`: `{ id, order, component }`; `media` reads it above the files.
- Produces: point `timelineTabs` in `timeline.points.ts`: `{ id, component }`, drawn above the ruler.
- Produces: `CompositionApi { dialog: StoreApi<{ open: null | { mode: "new" } | { mode: "settings"; compositionId } ; pendingDrop?: TimelineDrop }>; openNew(): void; openSettings(id): void }`. `pendingDrop` is added in Task 8.
- `createEmptyProject()` returns no compositions, no tracks, `mainCompositionId: null`, and `seedProject` becomes the only source of a populated project.

UI decisions: the side panel title is `Library`. The dialog uses `NumberField`, `SelectField`, `ColorField`, `ToggleRow`. The timecode field for duration parses `mm:ss:ff`. Width and height keep their ratio while the lock is on. The Resize choice appears in settings mode only when the size changed (the command part comes in Task 15; until then, hide it). `ProjectView`'s Canvas section shows the open composition and a Composition Settings button; `inspector` adds `composition` to `uses`. The empty message is a `timelineOverlays` entry shown only when nothing is open. The preview uses `EmptyState` with the seal.

`INSTRUCTIONS` in `server.rs` gain:

```
- A project holds compositions, and each has its own tracks and clips. You have your own open composition, set by `composition_open`. An empty project has none: import media, then call `composition_create_from_media` or `composition_create`.
```

Change the first line to `Start with project_get_state to see compositions, media, tracks and clips.`

- [ ] **Step 1: Add `ContextMenu` and `Dialog`** to the kit (sharp shapes, tokens only, `Popover` for positioning if it fits), exported from `@/ui`.
- [ ] **Step 2: Add the two points** and read them in `MediaLibrary` and `TimelinePanel`. Rename the panel.
- [ ] **Step 3: Build the composition UI** and contribute it. Tile click selects (`composition.store.ts`, not in history) and the inspector's Project view shows that composition's settings summary; double-click runs `openComposition`, right-click offers Open, Composition Settings, Set as Main, Duplicate, Delete.
- [ ] **Step 4: Remove `FormatPicker`** and the Transport entry. Update `ProjectView`.
- [ ] **Step 5: Switch `createEmptyProject()` to empty.** Add the `INSTRUCTIONS`, and update `CLAUDE.md` (the v1 scope, the module list, rule 13's points).
- [ ] **Step 6: Run** `pnpm typecheck && pnpm lint && pnpm test`, `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`. Expected: all pass.
- [ ] **Step 7: Check by hand.** New Composition with a Custom size and a red background shows that frame and colour; a second composition gets a tab, and each tab keeps its playhead; the preview has no size buttons left.
- [ ] **Step 8: Commit** `feat(composition): new composition, Library and timeline tabs`.

### Task 6: End marker, Collab and Follow

**Files:**

- Create: `src/modules/composition/ui/EndMarker.tsx`, `ui/end.gesture.ts`
- Modify: `src/modules/timeline/ui/TimelinePanel.tsx`, `src/modules/collab/logic/locate.ts`, `logic/targets.ts`, `collab.follow.ts`, `README.md`
- Modify: `src/modules/composition/ui/CompositionTabs.tsx`, `CompositionTile.tsx` (mark `data-collab-target="composition:<id>"`)

**Interfaces:**

- Consumes: `setSettings`. Timeline can't import `composition`, so `EndMarker` is contributed by `composition` through `timelineOverlays`, and the timeline exports what it needs (`pxToTime`, `timeToPx`).
- Timeline-owned: a dim layer past `composition.duration` in `TimelinePanel` (rule 26: inside lanes, positioned, no per-frame state).

Decisions: while dragging, the marker updates the DOM directly (rule 24) and sends one `setSettings { duration, extendToFit: false }` on release. The timeline's empty-area context menu gets Extend to fit (`extendToFitOnce`). `locate` resolves a clip in a composition the user doesn't have open to that composition's tab, else its Library tile. Follow also calls `view.setOpen(LOCAL_ACTOR, view.openFor(agent))`.

- [ ] **Step 1: Implement** the marker, dim layer, menu entry, locate and Follow. No tests: rule 3, and `locate` reads the DOM.
- [ ] **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 3: Check by hand.** Drag the marker in: Extend to fit turns off, clips past it dim and don't play, one Ctrl+Z restores it. An agent working in a closed composition: its pointer sits on the Library tile, and on the tab once that is open.
- [ ] **Step 4: Commit** `feat(composition): length marker, and agents working in other compositions`.

## Phase 2: The automatic start

### Task 7: Early metadata from ffprobe

**Files:**

- Modify: `src-tauri/src/media/proxy.rs`
- Modify: `src/modules/media/media.types.ts`, `media.service.ts`, `media.store.ts`, `README.md`

**Interfaces:**

- Produces: `ProxyInfo.meta?: { width: number; height: number; fps: number; duration: Micros }`, `MediaProbe.fps?: number`, `MediaApi.pictureMeta(mediaId): { width; height; fps; duration } | undefined`.

Decisions: `Probe` already has `width`, `height`, `duration_us`; add `fps: Option<f64>` from the video stream's `avg_frame_rate` (`"30000/1001"`, `"0/0"` means none; fall back to `r_frame_rate`). Send `meta` on the first event after `ffprobe`, serialized camelCase next to `hasAudio`. The webview probe keeps being the authority for `posterUrl`; `pictureMeta` returns `probe` values when ready, else `proxy.meta`, with `fps ?? 30`.

- [ ] **Step 1: Write the failing Rust test** in `proxy.rs`:

```rust
#[test]
fn reads_a_fractional_frame_rate() {
    assert!((parse_rate("30000/1001").unwrap() - 29.97).abs() < 0.01);
    assert_eq!(parse_rate("0/0"), None);
}
```

- [ ] **Step 2: Run** `cd src-tauri && cargo test parse_rate`. Expected: FAIL.
- [ ] **Step 3: Implement** `parse_rate`, the `meta` payload, and the TypeScript side.
- [ ] **Step 4: Run** `cargo clippy --all-targets -- -D warnings && cargo test`, then `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(media): report size, frame rate and length as soon as ffprobe has read a file`.

### Task 8: Dropping onto nothing

**Files:**

- Modify: `src/modules/media/media.drag.ts`, `media.types.ts`, `index.ts`, `ui/MediaTile.tsx`
- Modify: `src/modules/timeline/timeline.points.ts`, `timeline.types.ts`, `index.ts`, `ui/TimelinePanel.tsx`, `ui/TrackLane.tsx`, `ui/CreateTiles.tsx`
- Create: `src/modules/timeline/logic/drop.ts`
- Modify: `src/modules/composition/composition.commands.ts`, `composition.mcp.ts`, `composition.module.ts`
- Create: `src/modules/composition/composition.drop.ts`, `ui/PendingDrop.tsx`
- Test: additions to `composition.commands.test.ts`

**Interfaces:**

- Produces: `LibraryItem = { type: string; id: string }`; `MediaDragDetail { item: LibraryItem; clientX; clientY }`; `startMediaDrag(item, label, down)`.
- Produces: point `timelineDropHandlers`, `TimelineDropHandler { id; handle(drop: TimelineDrop): boolean }`, where `TimelineDrop = { item: LibraryItem | { type: "element"; kind: string; props: Record<string, unknown> }; start?: Micros; trackId?: TrackId }`. `dispatchDrop(handlers, drop, fallback)` in `logic/drop.ts` calls handlers in order, then `fallback`. `TimelinePanel`, `TrackLane` and `CreateTiles` all go through it, so a tile click with nothing open is also covered.
- Produces: command `createFromMedia { mediaIds: string[] } → { compositionId, clips }`, tool `composition_create_from_media`.

Decisions for the handler (`composition.drop.ts`), in this order:

1. `item.type === "composition"` and nothing open: `openComposition`. With something open: Task 12.
2. Something open: return `false` (normal drop).
3. Compositions exist: `setOpen` Main for the user, then re-dispatch.
4. No composition, a video file: wait for `pictureMeta` outside the bus with a timeout-free subscription, showing `PendingDrop`; a second drop replaces it, Escape cancels it, a probe error goes to `notify`. Then `createFromMedia`.
5. No composition, audio or an element: open the dialog with `pendingDrop`; confirming creates the composition, then re-dispatches.

`createFromMedia` validates before writing: each id exists, at least one has a picture, and every item has `pictureMeta`, else `media.not_ready`. It takes settings from the first item with a picture; names the composition after that file without its extension; sets `extendToFit: true`; places items in sequence from 0; all in one `ctx.mutate`. To place, reuse the logic behind `addClip` by exporting it from `timeline` (`placeMedia(draft, compositionId, mediaId, start, …)`), not by running a nested command.

- [ ] **Step 1: Write the failing tests**

```ts
it("makes a composition matching the file, in one undo step", async () => {
  fakeMedia.meta(mediaId, { width: 3840, height: 2160, fps: 30000 / 1001, duration: 12_000_000 });
  const { compositionId } = await ok(createFromMedia, { mediaIds: [mediaId] });
  const c = state().compositions[compositionId]!;
  expect(c.format).toEqual({ width: 3840, height: 2160, fps: 30000 / 1001 });
  expect(c.name).toBe("beach");
  expect(c.extendToFit).toBe(true);
  expect(c.duration).toBe(12_000_000);
  kernel.history.undo(LOCAL_ACTOR);
  expect(state().compositions).toEqual({});
  expect(state().clips).toEqual({});
});
it("takes settings from the first item with a picture", async () => {
  const { compositionId } = await ok(createFromMedia, { mediaIds: [audioId, videoId] });
  expect(state().compositions[compositionId]!.format.width).toBe(3840);
});
it("refuses a file still being read, and audio alone", async () => {
  expect(await failure(createFromMedia, { mediaIds: [pendingId] })).toBe("media.not_ready");
  expect(await failure(createFromMedia, { mediaIds: [audioId] })).toBe("composition.no_picture");
});
it("opens Main for a drop when compositions exist and none is open", () => {
  view.setOpen(LOCAL_ACTOR, null);
  handler.handle({ item: { type: "media", id: mediaId } });
  expect(view.openFor(LOCAL_ACTOR)).toBe(main);
  expect(Object.keys(state().compositions)).toHaveLength(1);
});
```

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the typed drag, the point, `dispatchDrop`, the handler, the command and the tool.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 5: Check by hand.** A fresh project: drop a 4K file, see a matching composition; undo once; drop a text tile, get the dialog; cancel, nothing lands; import a ProRes file and drop it straight away, and it lands before the proxy finishes.
- [ ] **Step 6: Commit** `feat(composition): create a composition by dropping a file`.

## Phase 3: Nesting

### Task 9: Placements in the document

**Files:**

- Modify: `src/modules/project/logic/compositions.ts`, `project.selectors.ts`, `src/modules/element/element.types.ts`, `README.md`
- Modify: `src/modules/timeline/timeline.guards.ts`, `timeline.clip.commands.ts`, `logic/placement.ts`, `index.ts`
- Create: `src/modules/composition/composition.element.ts`, `composition.place.command.ts`
- Modify: `composition.commands.ts`, `composition.mcp.ts`, `composition.module.ts`
- Test: additions to `compositions.test.ts`, `composition.commands.test.ts`

**Interfaces:**

- Produces: `ElementDefinition.source: "media" | "none" | "composition"`, `PictureDefinition.source?: "media" | "composition"`.
- Produces: `compositionElement` (`kind: "composition"`, `tracks: ["video", "audio"]`, `supports: { transform: true }`, `picture: { fit: "contain", source: "composition" }`, `display` uses the composition's name, `color: "clip-composition"`, `body: "none"`; add the token to `src/ui/styles/` for both themes and map it in `src/index.css`).
- Produces: `sourceDuration(state, clip, media: { duration(mediaId): Micros | undefined }): Micros | null`, for the trim limit.
- Produces: command `placeComposition { compositionId, start?, trackId?, audioTrackId? } → { clips }` in the open composition, tool `composition_place`. Always creates both clips with a shared `linkId` and `compositionRef`.
- Extends `settleCompositions`: inner first, order by `contains`. After setting durations, for each placement with `sourceIn + duration > length`: move `sourceIn` back to `max(0, length - frame)` if `sourceIn >= length`, then shorten. A placement's partner shortens the same way. For a junction whose overlap no longer fits (the left clip's end is below `rightClip.start + junction.duration`), delete the junction and set the left clip's end to the right clip's start, for the linked sound pair too. Never change a `start`.

- [ ] **Step 1: Write the failing tests**

```ts
it("shortens every placement in the same step when the original shrinks", () => {
  const after = settled(shrink(twoPlacements, "intro", 3_000_000));
  expect(after.clips.p1!.duration).toBe(3_000_000);
  expect(after.clips.p1Sound!.duration).toBe(3_000_000);
});
it("leaves placements alone when the original grows", () => {
  expect(settled(grow(twoPlacements, "intro")).clips.p1!.duration).toBe(5_000_000);
});
it("settles nested originals innermost first", () => {
  // inner shrinks, middle is Extend to fit, outer's placement of middle shortens
  expect(settled(chain).clips.outerPlacement!.duration).toBe(2_000_000);
});
it("removes a broken transition and leaves no overlap, moving nothing", () => {
  const after = settled(shrink(leftAndRightWithTransition, "intro", 9_500_000));
  expect(after.junctions).toEqual({});
  expect(after.clips.left!.start + after.clips.left!.duration).toBe(after.clips.right!.start);
  expect(after.clips.right!.start).toBe(9_000_000);
  expect(projectPolicy.validate(after)).toBeNull();
});
it("refuses a cycle, direct and through another composition", async () => {
  view.setOpen(LOCAL_ACTOR, "a");
  expect(await failure(placeComposition, { compositionId: "a" })).toBe("composition.cycle");
  expect(await failure(placeComposition, { compositionId: "outerOfA" })).toBe("composition.cycle");
});
it("adds a sound clip for a silent composition", async () => {
  const { clips } = await ok(placeComposition, { compositionId: "silent" });
  expect(clips).toHaveLength(2);
  expect(state().clips[clips[1]!]!.linkId).toBe(state().clips[clips[0]!]!.linkId);
});
it("limits a placement's trim to the composition's length", async () => {
  expect(trimLimitOf(placementOf5s).max).toBe(5_000_000);
});
```

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** Refuse deleting a placed composition with `composition.in_use` (`placementsOf`).
- [ ] **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(composition): place a composition as a clip`.

### Task 10: Frame resolving and path keys

No visible change yet: one engine path, keyed by placement path, with today's behaviour.

**Files:**

- Create: `src/modules/preview/logic/frame.ts`, `logic/frame.test.ts`
- Modify: `src/modules/preview/preview.types.ts` or `engine/engine.types.ts`, `engine/engine.html.ts`, `engine.slots.ts`, `engine.audio.ts`, `engine.mix.ts`, `logic/junctions.ts`, `README.md`

**Interfaces:**

- Produces in `engine.types.ts`:

```ts
export interface ResolvedClip {
  clip: Clip;
  /** Placement ids down to this clip, joined by "/". Keys slots and canvases. */
  path: string;
  /** This clip's composition's clock at the frame. */
  time: Micros;
  /** The nested frame of a composition clip. */
  inner?: ResolvedFrame;
}
export interface ResolvedTrack {
  track: Track;
  clips: ResolvedClip[];
}
export interface ResolvedFrame {
  composition: Composition;
  tracks: ResolvedTrack[]; // trackOrder order
  /** Starting within the preload window, at any depth. */
  upcoming: Array<{ path: string; clip: Clip; track: Track; time: Micros }>;
}
```

- Produces: `resolveFrame(project: ProjectState, compositionId: CompositionId, time: Micros, opts: { pictureOnly: boolean; preloadAhead: Micros }): ResolvedFrame`.
- A clip's inner time is `clip.sourceIn + time - clip.start`. Hidden outer tracks skip descent for pictures only. Picture descent uses a video placement; sound descent uses its linked sound clip, so `inner` of an audio-track clip holds only audio tracks, and of a video-track clip only video tracks.
- Slot keys change from `clip.id` to `path` everywhere in `MediaSlotPool`: `acquire`, `release(needed)`, `elementOf`, `hasFrame`. `Slot.clipId` becomes `Slot.path`. Reuse across splits still looks at the same parent path and media.
- `soundGains(project, time)` becomes per-frame: `soundGains(project, composition, time)`, keyed by `clip.id` and looked up per resolved level.

- [ ] **Step 1: Write the failing tests**

```ts
it("descends with local time", () => {
  const frame = resolveFrame(placedAt2sTrimmedBy1s, "outer", 3_000_000, opts);
  const inner = frame.tracks[0]!.clips[0]!.inner!;
  expect(inner.tracks[0]!.clips[0]!.time).toBe(2_000_000);
});
it("gives two placements of one composition separate paths and times", () => {
  const frame = resolveFrame(sameCompTwiceOverlapping, "outer", 3_000_000, opts);
  const [a, b] = innerClips(frame);
  expect(a!.path).toBe("p1/x");
  expect(b!.path).toBe("p2/x");
  expect(a!.time).not.toBe(b!.time);
});
it("preloads a clip about to start inside a placement", () => {
  expect(resolveFrame(innerClipStartsSoon, "outer", 0, opts).upcoming[0]!.path).toBe("p1/y");
});
it("ignores what is inside a hidden track's placement", () => {
  expect(innerClips(resolveFrame(hiddenOuter, "outer", 0, opts))).toEqual([]);
});
it("matches the flat engine on a project with no nesting", () => {
  expect(flatten(resolveFrame(flat, "c1", 1_000_000, opts))).toEqual(["a", "b"]);
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/modules/preview/logic/frame.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `resolveFrame`,** and rewrite the walk at the top of `render` to use it, with no nested drawing yet (a composition clip draws nothing).
- [ ] **Step 4: Change the slot keys** and the transition paths in `engine.mix.ts` and `engine.audio.ts` to `path`.
- [ ] **Step 5: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 6: Check by hand.** Playback, a split across a cut, and a transition behave as before.
- [ ] **Step 7: Commit** `refactor(preview): resolve a frame as a tree keyed by placement path`.

### Task 11: Drawing and hearing nested compositions

**Files:**

- Create: `src/modules/preview/engine/engine.nested.ts`
- Modify: `engine/engine.html.ts`, `engine.mix.ts`, `engine.audio.ts`, `src/modules/transform/logic/layers.ts`, `src/modules/preview/README.md`

**Interfaces:**

- Produces: `NestedCanvases` in `engine.nested.ts`: `take(path, width, height): HTMLCanvasElement`, `release(needed: Set<string>)`, `dispose()`. Default accelerated 2D canvases with alpha, never `willReadFrequently` (see `src/modules/preview/README.md`). Canvas size is the composition's `format` scaled by the outer `kx`/`ky`, capped at the main canvas's largest side, so a nested 4K composition in a small preview stays cheap.
- `transform/logic/layers.ts`: `source: "composition"` takes its size from `state.compositions[clip.compositionRef].format`.

Decisions: `drawClip` for a `source: "composition"` clip renders `inner` into its canvas (clear first, no background, video tracks bottom to top, same `drawTrack`), then draws that canvas with `clipPlacement(format, compositionSize, transform)` like a video frame. Rendering of inner clips always uses document values: `transforms` and `propsOverrides` pass as empty below the top level. `settled` is false if any layer at any depth lacks its frame (rule 22). Inner `kx`, `ky` come from the nested canvas's own size against its composition's format.

Sound: for each resolved audio clip at any depth, gain is the product of `soundGains` at each level, and muted if any track in the chain is muted. `voiceSlot` takes the final gain. A hidden video track does not silence its sound (sound lives on audio tracks).

Decoder limit: `MAX_ACTIVE_ELEMENTS = 8` in `engine.slots.ts`. Above it, `acquire` returns null for the deepest paths, and the engine logs and calls `notify("info", …)` once per engine, saying the preview is showing what it can. Such a layer counts as drawn, not as unsettled, so the frame still paints.

- [ ] **Step 1: Implement** `NestedCanvases`, drawing, sound, and the limit. No new test: `resolveFrame` holds the logic, the rest is canvas work.
- [ ] **Step 2: Check by hand** with `pnpm tauri dev`, using agent tools to set it up and `preview_capture_frame` to look:
  - A 1080×1080 composition with a logo over a transparent area placed on a video: the video shows through.
  - The same composition placed twice with different scale: both mirror an edit inside.
  - A transition between a video and a placement.
  - A placement with its track muted is silent; a clip's sound inside plays otherwise.
  - The canvas transform tools move and rotate a placement like a video.
- [ ] **Step 3: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 4: Commit** `feat(preview): draw and play compositions inside compositions`.

### Task 12: Placing from the Library

**Files:**

- Modify: `src/modules/composition/composition.drop.ts`, `ui/CompositionTile.tsx`, `composition.module.ts`, `README.md`
- Modify: `src/modules/timeline/ui/TimelineClip.tsx`, `timeline.points.ts`

**Interfaces:**

- Produces: `Tile.placements: number` from `placementsOf`.
- Produces: point `clipDoubleClick` in `timeline.points.ts`: `{ id; handle(clip: Clip): boolean }`.

Decisions: with something open, a `composition` item runs `placeComposition` with the drop's `start` and `trackId`; a cycle's refusal reaches the user through the normal command-failure toast, whose message says why. Double-clicking a placement runs `openComposition`, through `clipDoubleClick`. Tile thumbnails: icon and size for now.

- [ ] **Step 1: Implement** the drop, the count and the double-click.
- [ ] **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 3: Check by hand.** Drag Intro onto Main three times, double-click one, fix a typo, return: all three changed. Drag Main onto Intro: refused with the reason. The tile says 3.
- [ ] **Step 4: Commit** `feat(composition): drag compositions from the Library onto a timeline`.

## Phase 4: Advanced

### Task 13: Make unique

**Files:**

- Create: `src/modules/composition/composition.unique.command.ts`, `logic/clone.ts`
- Modify: `composition.commands.ts` (duplicate uses `cloneComposition`), `composition.mcp.ts`, `ui/` (contribute to the clip's context menu), `README.md`
- Test: additions to `composition.commands.test.ts`

**Interfaces:**

- Produces: `cloneComposition(draft, compositionId, name): CompositionId` in `logic/clone.ts`, shared with `duplicateComposition`; ids renewed, `linkId`s remapped, junction clip ids remapped, inner `compositionRef`s left shared.
- Produces: command `makeUnique { clipId } → { compositionId }`, tool `composition_make_unique`. Applies to the clip and its linked partner. Name is `"<name> copy"`, then `"<name> copy 2"`, and so on.
- Produces: point `clipContextMenu` in `timeline.points.ts`: `{ id, items(clip: Clip): MenuItem[] }`, read by a right-click on a clip.

- [ ] **Step 1: Write the failing tests**

```ts
it("points one placement and its sound at a copy, leaving the others", async () => {
  const { compositionId } = await ok(makeUnique, { clipId: "p1" });
  expect(state().clips.p1!.compositionRef).toBe(compositionId);
  expect(state().clips.p1Sound!.compositionRef).toBe(compositionId);
  expect(state().clips.p2!.compositionRef).toBe("intro");
  expect(state().compositions[compositionId]!.name).toBe("Intro copy");
});
it("keeps inner compositions shared", async () => {
  await ok(makeUnique, { clipId: "p1" });
  expect(placementsOf(state(), "logo")).toHaveLength(4); // two before, two in the copy
});
it("refuses a clip that is not a placement", async () => {
  expect(await failure(makeUnique, { clipId: "text1" })).toBe("composition.not_placed");
});
```

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the clone, the command, the point and the menu entry.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(composition): make a placement unique`.

### Task 14: Group into composition

**Files:**

- Create: `src/modules/composition/composition.group.command.ts`, `logic/group.ts`
- Modify: `composition.commands.ts`, `composition.mcp.ts`, `ui/` (menu entry), `README.md`
- Test: `src/modules/composition/logic/group.test.ts`, additions to `composition.commands.test.ts`

**Interfaces:**

- Consumes: `withPartners` from `project`, `clipContextMenu`.
- Produces: `planGroup(state, clipIds): GroupPlan | { blocked: Clip }` in `logic/group.ts`, pure: `{ span: { start, end }, videoTrack, audioTrack, clips, droppedJunctions }`.
- Produces: command `groupClips { clipIds } → { compositionId, clips }`, tool `composition_group`.

Decisions are the Spec's Group section; all selected clips must be in one composition. Inner tracks keep the source tracks' kind, name and order. A junction with both clips inside moves with them.

- [ ] **Step 1: Write the failing tests**

```ts
it("spans the selection on the topmost selected tracks, rebased to 0", () => {
  const plan = planGroup(clipsAt2And6Seconds, ["a", "b"]);
  expect(plan).toMatchObject({ span: { start: 2_000_000, end: 8_000_000 }, videoTrack: "t1" });
});
it("is blocked by an unselected clip inside the span", () => {
  expect(planGroup(gapWithOther, ["a", "b"])).toMatchObject({ blocked: { id: "other" } });
});
it("brings linked partners, and drops a junction crossing the edge", () => {
  const plan = planGroup(linkedWithTransitionToOutside, ["a"]);
  expect(plan).toMatchObject({ clips: ["a", "aSound"], droppedJunctions: ["j1"] });
});
it("groups in one undo step, with Extend to fit off", async () => {
  const { compositionId } = await ok(groupClips, { clipIds: ["a", "b"] });
  expect(state().compositions[compositionId]).toMatchObject({
    extendToFit: false,
    duration: 6_000_000,
  });
  kernel.history.undo(LOCAL_ACTOR);
  expect(state().clips.a!.start).toBe(2_000_000);
});
it("refuses with composition.group_blocked, changing nothing", async () => {
  expect(await failure(groupClips, { clipIds: ["a", "b"] })).toBe("composition.group_blocked");
});
it("gives an audio-only selection both clips", async () => {
  const { clips } = await ok(groupClips, { clipIds: ["sound1"] });
  expect(clips).toHaveLength(2);
});
```

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** `planGroup` and the command.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(composition): group clips into a composition`.

### Task 15: Resize with Scale content

**Files:**

- Create: `src/modules/composition/logic/resize.ts`, `logic/resize.test.ts`
- Modify: `composition.commands.ts`, `ui/CompositionDialog.tsx`, `README.md`

**Interfaces:**

- Consumes: the `element` API, for each clip's `picture.fit`.
- Produces: `scaleTransform(transform: ClipTransform, fit: ClipFit, before: ProjectFormat, after: ProjectFormat): ClipTransform`.
- `setSettings` gains `resize?: "keep" | "scale"`, default `"keep"`, applying to clips directly in that composition. Clips without the transform group are left alone. A placement of this composition elsewhere is untouched.

- [ ] **Step 1: Write the failing tests**

```ts
it("keeps a contain picture's scale, and maps its offset by each axis", () => {
  expect(scaleTransform(t({ x: 100, y: 200, scale: 2 }), "contain", vertical, landscape)).toEqual(
    t({ x: 100 * (1920 / 1080), y: 200 * (1080 / 1920), scale: 2 }),
  );
});
it("scales a fit none picture by the smaller ratio", () => {
  expect(scaleTransform(t({ scale: 1 }), "none", vertical, landscape).scale).toBe(1080 / 1920);
});
it("does nothing at the same size", () => {
  expect(scaleTransform(t({ x: 5 }), "none", vertical, vertical)).toEqual(t({ x: 5 }));
});
```

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement,** and show the Resize choice in the dialog when the size changed.
- [ ] **Step 4: Run** `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.
- [ ] **Step 5: Check by hand.** Text near the bottom of a 9:16 composition stays on screen after Scale content to 16:9; Ctrl+Z restores size and position together.
- [ ] **Step 6: Commit** `feat(composition): scale content when a composition is resized`.
