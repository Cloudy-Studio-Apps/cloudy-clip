# Mesa de noche: Media Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real Media page: bins, smart bins, disks, search, grid and list, solid colors, a viewer, file facts and metadata, plus the compact bin picker in Edit's Media tab.

**Architecture:** Bins, solids and metadata are document state, changed by undoable commands with MCP tools. What's open in the library is per-kernel view state. `solid` is a new feature module, and `media` (core) reaches its items through a new `libraryKinds` point, so core never imports a feature.

**Tech Stack:** TypeScript, React 19, Zustand, Zod, Immer; Rust (Tauri 2, `sysinfo`, ffprobe).

**Spec:** `docs/superpowers/specs/2026-11-02-mesa-de-noche-design.md`. Requires the Foundation plan.

**Visual reference:** `docs/prototype/designs/b-mesa-de-noche.html#page:media`

## File Tree

`+` is a new file and `~` is an edited file.

```
cloudy-clip/
├─ ~ CLAUDE.md                             solid in "Where to look"
├─ docs/
│  └─ ~ modules.md                         solid in the module table
├─ src-tauri/
│  ├─ ~ Cargo.toml                         sysinfo
│  ├─ ~ Cargo.lock
│  └─ src/media/
│     ├─ ~ commands.rs                     registers the two new commands
│     ├─ + disks.rs                        media_list_disks
│     ├─ + facts.rs                        media_file_facts
│     └─ ~ mod.rs
└─ src/
   ├─ app/
   │  └─ ~ bootstrap.ts                    lists solid
   └─ modules/
      ├─ media/
      │  ├─ ~ README.md
      │  ├─ ~ index.ts
      │  ├─ + media.bin.commands.ts        bin commands
      │  ├─ + media.bin.commands.test.ts
      │  ├─ ~ media.commands.ts            setInfo, rename, import into a bin
      │  ├─ + media.info.commands.test.ts
      │  ├─ ~ media.mcp.ts
      │  ├─ ~ media.module.ts
      │  ├─ ~ media.points.ts              libraryKinds
      │  ├─ ~ media.service.ts             facts, disks, reveal
      │  ├─ ~ media.types.ts
      │  ├─ + media.view.store.ts          open bin, search, layout, selection
      │  ├─ logic/
      │  │  └─ + library.ts                libraryRows
      │  └─ ui/
      │     ├─ + BinPicker.tsx             Edit's Media tab
      │     ├─ + BinTree.tsx
      │     ├─ + DiskList.tsx
      │     ├─ + FileFactsSection.tsx      also used by the Edit plan
      │     ├─ + FileInfoPanel.tsx
      │     ├─ + LibraryListRow.tsx
      │     ├─ + LibraryRows.tsx
      │     ├─ + LibrarySidebar.tsx
      │     ├─ + LibraryToolbar.tsx
      │     ├─ ~ MediaGrid.tsx
      │     ├─ ~ MediaHeader.tsx
      │     ├─ ~ MediaLibrary.tsx
      │     ├─ ~ MediaPage.tsx             the three columns
      │     ├─ ~ MediaTile.tsx
      │     ├─ + MediaViewer.tsx
      │     ├─ + MetadataSection.tsx       also used by the Edit plan
      │     ├─ + SmartBinList.tsx
      │     ├─ + file.facts.hook.ts
      │     ├─ + library.rows.hook.ts
      │     └─ ~ media.pick.hook.ts        defaultPath
      ├─ project/
      │  ├─ ~ README.md
      │  ├─ ~ project.mcp.ts               only if it lists document fields
      │  ├─ ~ project.store.ts             empty bins and solids, rules
      │  └─ ~ project.types.ts             Bin, Solid, MediaInfo
      ├─ solid/
      │  ├─ + README.md
      │  ├─ + index.ts
      │  ├─ + solid.commands.ts
      │  ├─ + solid.commands.test.ts
      │  ├─ + solid.drop.ts
      │  ├─ + solid.element.ts
      │  ├─ + solid.mcp.ts
      │  ├─ + solid.module.ts
      │  ├─ + solid.ref.ts
      │  ├─ + solid.types.ts
      │  └─ ui/
      │     ├─ + SolidButton.tsx
      │     ├─ + SolidDialog.tsx
      │     ├─ + SolidTile.tsx
      │     └─ + index.ts
      └─ workspace/logic/
         ├─ ~ format.ts                    project file version 2
         └─ ~ format.test.ts
```

## Global Constraints

- Follow `CLAUDE.md`: every document change is a command, tools are thin `commandTool` wrappers, times are `Micros`, ids come from `createId()`.
- Update the README of each module you change, in the same commit, and the module table in `docs/modules.md` for `solid`.
- Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass; Rust changes also pass `cargo clippy --all-targets -- -D warnings` and `cargo test`.
- Commits have no Co-Authored-By line.
- Tests only for document integrity and old-file loading (rule 3). UI gets none.

## Review Focus

- Opening a version 1 project: bins and solids are empty, nothing is lost, and saving writes version 2.
- Deleting a bin that holds files or sub-bins: nothing disappears. Contents move to the parent, and undo restores everything in one step.
- A missing or offline file in the viewer and File facts shows a clear message and offers relink. It doesn't show an endless spinner.
- A library of 500 files: typing in search stays smooth, and the grid doesn't re-render on playback ticks.
- ffprobe missing: the page still works, and codec facts show `—`.

---

### Task 1: Bins in the document

**Files:**

- Modify: `src/modules/project/project.types.ts`, `project.store.ts`, `project.mcp.ts` if it lists fields, `README.md`
- Modify: `src/modules/workspace/logic/format.ts`, `format.test.ts`
- Create: `src/modules/media/media.bin.commands.ts`, `src/modules/media/media.bin.commands.test.ts`
- Modify: `src/modules/media/media.commands.ts`, `media.mcp.ts`, `README.md`

**Interfaces:**

- Produces:

```ts
export type BinId = string;
export interface Bin {
  id: BinId;
  name: string;
  /** Null sits directly in Master. */ parentId: BinId | null;
}
// ProjectState gains: bins: Record<BinId, Bin>; binOrder: BinId[];
// MediaAsset gains: binId?: BinId; /** ms since the epoch */ importedAt?: number;
```

Commands: `media.createBin { name, parentId? } → { binId }`, `media.renameBin { binId, name }`, `media.deleteBin { binId }`, `media.moveToBin { mediaIds, binId: BinId | null }`. `media.import` gains an optional `binId`. Tools: `media_create_bin`, `media_rename_bin`, `media_delete_bin`, `media_move_to_bin`. Failures: `media.no_bin`, `media.bin_cycle`.

- [ ] **Step 1: Write the failing tests**

In `format.test.ts`: `opens a version 1 file with no bins`, asserting `bins` equals `{}` and `binOrder` equals `[]`. In `media.bin.commands.test.ts`:

```ts
it("moves a deleted bin's files and sub-bins to its parent, in one undo", () => {
  /* … */
  expect(state.media[a].binId).toBeUndefined();
  expect(state.bins[child].parentId).toBeNull();
  history.undo();
  expect(state.bins[parent]).toBeDefined();
  expect(state.media[a].binId).toBe(parent);
});
it("refuses a bin inside its own descendant" /* media.bin_cycle */);
```

- [ ] **Step 2: Run them**

Run: `pnpm vitest run src/modules/workspace/logic/format.test.ts src/modules/media/media.bin.commands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Set `VERSION = 2`. In `decodeProject`, fill the missing `bins`, `binOrder`, `solids` and `solidOrder` when the file is version 1. Add `bins: {}`, `binOrder: []` to `createEmptyProject()`. Add the optional fields to the Zod schema as loose. Add the bin rules to the store policy `validate`: `binId` exists, no parent cycle. `solids` and `solidOrder` arrive in Task 2 but are upgraded here, so declare them now as well.

- [ ] **Step 4: Run them**

Run: the command from Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(media): bins in the document, with undoable commands and tools"
```

### Task 2: Solid colors

**Files:**

- Create: `src/modules/solid/` with `index.ts`, `solid.ref.ts`, `solid.module.ts`, `solid.types.ts`, `solid.commands.ts`, `solid.commands.test.ts`, `solid.mcp.ts`, `solid.element.ts`, `solid.drop.ts`, `README.md`, `ui/SolidDialog.tsx`, `ui/SolidTile.tsx`, `ui/SolidButton.tsx`, `ui/index.ts`
- Modify: `src/modules/project/project.types.ts`, `src/modules/media/media.points.ts`, `media.types.ts`, `index.ts`, `src/app/bootstrap.ts`, `docs/modules.md`, `CLAUDE.md` (Where to look)

**Interfaces:**

- Produces in `project`:

```ts
export type SolidId = string;
export interface Solid {
  id: SolidId;
  name: string;
  color: string;
  width: number;
  height: number;
  binId?: BinId;
}
// ProjectState gains: solids: Record<SolidId, Solid>; solidOrder: SolidId[];
```

- Produces in `media`: `LibraryItem.type` widens to `string`, plus a new point:

```ts
export interface LibraryEntry {
  id: string;
  name: string;
  binId?: BinId;
}
/** A kind of item the library lists besides files: its smart bin, tile and create button. */
export interface LibraryKind {
  type: string;
  label: string; // smart bin name, e.g. "Solid colors"
  icon: PanelIcon;
  useEntries(): readonly LibraryEntry[];
  Tile: ComponentType<{ id: string }>;
  CreateButton?: ComponentType;
}
export const libraryKinds = definePoint<LibraryKind>("media.libraryKinds");
```

- Produces in `solid`: element kind `solid` (`tracks: ["video"]`, `supports: { transform: true }`, prop `color`, `fit: "none"`, `size` from `props.width`/`props.height`, `draw` as a `fillRect` over `env.placement`). Commands `solid.create`, `solid.update`, `solid.remove`. Tools `solid_create`, `solid_update`, `solid_remove`.
- Requires: `project`, `element`, `media`, `timeline`, `transform`.

- [ ] **Step 1: Write the failing test**

In `src/modules/solid/solid.commands.test.ts`: `a clip keeps its colour after its library solid is removed`.

```ts
expect(state.clips[clipId].props.color).toBe("#112233");
```

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/modules/solid/solid.commands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the module**

Add the point and the module. `solid.drop.ts` contributes to `timelineDropHandlers`, as `composition.drop.ts` does; a drop adds a `solid` clip of 5 seconds with `color`, `width` and `height` copied in. Port `#solid-dialog` to `Dialog` with `ColorField`, 16 quick colours, name and size. Default the size to the open composition's format.

- [ ] **Step 4: Run it**

Run: the command from Step 2, then `pnpm typecheck && pnpm lint`.
Expected: PASS.

- [ ] **Step 5: Check export**

Drop a solid on a timeline in the app and export it.
Expected: the colour shows in preview and in the exported file, since export draws through the preview engine.

- [ ] **Step 6: Commit**

```bash
git add src docs/modules.md CLAUDE.md
git commit -m "feat(solid): solid colors in the library and on the timeline"
```

### Task 3: Facts from the file and disks

**Files:**

- Create: `src-tauri/src/media/facts.rs`, `src-tauri/src/media/disks.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/src/media/mod.rs`, `src-tauri/src/media/commands.rs`, `src/modules/media/media.service.ts`, `media.types.ts`, `media.module.ts`, `index.ts`, `README.md`

**Interfaces:**

- Produces, with Rust mirrored in TypeScript:

```ts
export interface FileFacts {
  videoCodec?: string;
  audioCodec?: string;
  sampleRate?: number;
  channels?: number;
  sampleFormat?: string;
  timecode?: string;
  /** ms since the epoch */ createdAt?: number;
}
export interface DiskInfo {
  name: string;
  mountPoint: string;
  totalBytes: number;
  freeBytes: number;
}
// MediaApi gains: fileFacts(id: MediaId): Promise<FileFacts>; listDisks(): Promise<DiskInfo[]>;
//                 revealFile(path: string): Promise<void>;
```

Native commands: `media_file_facts`, `media_list_disks`.

- [ ] **Step 1: Write the failing Rust test**

In `facts.rs`, `parses_streams_and_timecode` feeds a stored ffprobe JSON string to `parse_facts(json: &str) -> FileFacts`, and asserts `video_codec == Some("h264")`, `sample_rate == Some(48000)`, `timecode == Some("01:00:00:00")`.

- [ ] **Step 2: Run it**

Run: `cd src-tauri && cargo test parses_streams_and_timecode`
Expected: FAIL.

- [ ] **Step 3: Implement**

Run ffprobe with `-show_streams -show_format -of json`, through the same allowlisted path lookup as the proxy code. `created_at` comes from file metadata. Add `sysinfo` for disks, and leave out pseudo filesystems. `revealFile` uses `revealItemInDir` from `@tauri-apps/plugin-opener`, as `export.service.ts` does. Register the commands from the module's own file.

- [ ] **Step 4: Verify**

Run: `cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src src-tauri
git commit -m "feat(media): read file facts and list disks"
```

### Task 4: Metadata on a file

**Files:**

- Modify: `src/modules/project/project.types.ts`, `src/modules/media/media.commands.ts`, `media.mcp.ts`, `README.md`
- Create: `src/modules/media/media.info.commands.test.ts`

**Interfaces:**

- Produces:

```ts
export type MediaTag = "good" | "rejected";
export interface MediaInfo {
  camera?: string;
  reel?: string;
  scene?: string;
  shot?: string;
  take?: string;
  tag?: MediaTag;
  color?: string;
  comments?: string;
}
// MediaAsset gains: info?: MediaInfo
```

Untagged means `tag` is missing. Command `media.setInfo { mediaId, patch: Partial<MediaInfo> }`, tool `media_set_info`. `media.rename { mediaId, name }`, tool `media_rename`. A patch value of `null` clears that field.

- [ ] **Step 1: Write the failing test**

`setInfo merges, clears with null, and undoes in one step`.

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/modules/media/media.info.commands.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the commands and tools**

Follow `media.relink`. `media_list` also returns `info`, as rule 19 requires.

- [ ] **Step 4: Run it, then commit**

Run: the command from Step 2.
Expected: PASS.

```bash
git add src
git commit -m "feat(media): metadata and names on files, undoable"
```

### Task 5: Library view and filtering

**Files:**

- Create: `src/modules/media/media.view.store.ts`, `src/modules/media/logic/library.ts`
- Modify: `media.types.ts`, `media.module.ts`, `index.ts`

**Interfaces:**

- Produces:

```ts
export type LibraryPlace =
  | { kind: "bin"; binId: BinId | null } // null is Master
  | { kind: "smart"; id: string }; // "videos" | "audio" | "images" | "compositions" | "today" | a LibraryKind type
export interface LibraryView {
  place: LibraryPlace;
  search: string;
  layout: "grid" | "list";
  selection: readonly string[];
  autoNext: boolean;
}
export function libraryRows(input: LibraryInput): LibraryRow[]; // logic/library.ts
// MediaApi gains: view: StoreApi<LibraryView>
```

`LibraryRow` is `{ type, id, name }`. Master lists everything directly in Master, not its sub-bins. A smart bin lists across all bins. Search matches name, and all `MediaInfo` text fields, case-insensitively. "Imported today" compares `importedAt` with the local day start passed in as `input.dayStart`.

- [ ] **Step 1: Implement and verify**

The view store is plain per-kernel Zustand, never in history. Components call `libraryRows` inside `useMemo` (rule 25).
Run: `pnpm typecheck && pnpm lint`
Expected: pass.

- [ ] **Step 2: Commit**

```bash
git add src/modules/media
git commit -m "feat(media): library view state and row filtering"
```

### Task 6: The Media page

**Files:**

- Modify: `src/modules/media/ui/MediaPage.tsx`, `MediaTile.tsx`, `MediaGrid.tsx`, `media.pick.hook.ts`, `src/modules/media/README.md`
- Create in `src/modules/media/ui/`: `LibrarySidebar.tsx`, `DiskList.tsx`, `BinTree.tsx`, `SmartBinList.tsx`, `LibraryToolbar.tsx`, `LibraryRows.tsx`, `LibraryListRow.tsx`, `MediaViewer.tsx`, `FileInfoPanel.tsx`, `FileFactsSection.tsx`, `MetadataSection.tsx`, `file.facts.hook.ts`, `library.rows.hook.ts`

**Interfaces:**

- Consumes: Tasks 1–5.
- Produces, exported from `@/modules/media`: `FileFactsSection({ mediaId })` and `MetadataSection({ mediaId })`. The Edit plan uses both for the File tab.

- [ ] **Step 1: Three columns**

Grid `260px minmax(0,1fr) 340px`. The left column holds Disks, Bins and Smart bins with counts. The right column holds the viewer and file info. Compositions and `libraryKinds` appear as smart bins, and `CreateButton`s sit in the toolbar.

- [ ] **Step 2: Bin actions**

The `+` button starts an inline name field, and a `ContextMenu` offers rename and delete. Dragging tiles onto a bin runs `media.moveToBin`. An empty bin shows `EmptyState`. Import goes to the open bin; disks call `usePickMedia({ defaultPath: mountPoint })`. OS file drop on this page imports into the open bin too.

- [ ] **Step 3: Toolbar and rows**

Add breadcrumb, search, grid/list toggle, Solid color and Import. A red outline marks items used on the timeline, from a memoised set of `mediaId`s; its selector returns a joined string so unrelated edits don't re-render. Keep tile dragging onto the timeline through `startMediaDrag`. The tile shows Missing for `probe.status === "missing"` and offers relink through `useLocateMedia`.

- [ ] **Step 4: Viewer**

`MediaViewer` plays the selected file in its own element with `crossOrigin = "anonymous"`, using `mediaUrl` (the proxy when there is one), with play/pause and a scrubber. Solids show their colour. A composition shows its name and length only. It stops when you leave the page. Show the probe's error text when a file can't play.

- [ ] **Step 5: File info**

Port the prototype's File tab fields. `FileFactsSection` shows name, length, a three-column grid of facts, proxy state and Open file location. `MetadataSection` has read-only timecode and date, editable fields that commit on blur, the three-way Tag row and 16 clip colours. "Auto-select next unsorted clip" and "Next clip" appear on this page only, and Next goes to the next row without a tag.

- [ ] **Step 6: Verify in the app**

Run: `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm tauri dev`.
Expected: import into a bin, move, delete and undo, reopen the project, filter, play a file, edit metadata, drag to the timeline. Then an agent's `media_create_bin` appears live.

- [ ] **Step 7: Commit**

```bash
git add src/modules/media
git commit -m "feat(media): the Media page"
```

### Task 7: Edit's Media tab

**Files:**

- Modify: `src/modules/media/ui/MediaLibrary.tsx`, `MediaHeader.tsx`, `src/modules/media/media.module.ts`, `README.md`
- Create: `src/modules/media/ui/BinPicker.tsx`

**Interfaces:**

- Consumes: `LibraryView` from Task 5, so both places show the same bin.

- [ ] **Step 1: Rework the panel**

Rename the panel title to "Media". Add search, the small solid color button, Import and a compact `BinPicker` listing Master, bins and smart bins. Rows come from `libraryRows`. `librarySections` (compositions) stay above them.

- [ ] **Step 2: Verify and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass. Changing bin in Edit changes it on the Media page, and dragging to the timeline still works.

```bash
git add src/modules/media
git commit -m "feat(media): bin picker and search in Edit's Media tab"
```
