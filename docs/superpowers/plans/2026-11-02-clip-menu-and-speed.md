# Clip Menu and Clip Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full right-click menu on timeline clips, with new clipboard and edit tools, then constant clip speed with Freeze frame and Reverse, in preview and export.

**Architecture:** Part 1 extends the kit's menu, gives `clipActions` groups, and adds timeline commands that modules surface through that point. Part 2 adds `Clip.speed` in `project`, one pure time function every reader goes through, and a new `speed` feature module that owns the commands, tools, box and inspector section.

**Tech Stack:** TypeScript, React 19, Zustand, Immer, Zod, Vitest, Rust (Tauri 2), FFmpeg.

**Spec:** `docs/superpowers/specs/2026-11-02-clip-menu-and-speed-design.md`

## Global Constraints

- `CLAUDE.md` rules apply to every task. Read the README of each folder you change first (rule 1).
- A task is done when `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Rust tasks also pass `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`.
- Tests only for what rule 3 allows. The test steps below are the whole list. Add no others.
- Work on the current branch. Commits carry no `Co-Authored-By` line.
- All times are integer `Micros`. Round with `Math.round` only inside `project/logic/speed.ts`.
- A value equal to its default is never stored: a normal clip has no `speed` and no `disabled`.
- Every command and MCP tool has TSDoc, and every tool is `commandTool(command, { name })`.
- Follow the Mesa de noche look: semantic tokens, `font-hand` titles, red (`text-mark`) only for changed values.
- Speed range: `0.1` to `10`. Presets: `0.25, 0.5, 1, 1.5, 2, 4`. Freeze length: `3_000_000`.

## Review Focus

1. **Ctrl+C on the Media or Export page:** `mod` bindings run on every page, so it must not replace the clipboard. Tested in Task 3.
2. **Paste after the source is gone:** copy a clip, remove its media or composition, paste: a clear failure, nothing written. Tested in Task 3.
3. **Undo after a paste that made a track:** one undo removes the clips and the new track. Tested in Task 3.
4. **Speed changed repeatedly:** 3x then 1x must not walk the clip past the end of its file. Tested in Task 7.
5. **Box open when its clip disappears:** an undo or an agent deletes the clip, and the box closes. Implemented and checked in Task 9.

## Files

`+` is new, `~` is edited. Nothing is deleted.

```
src/
├─ ui/
│  ├─ index.ts                           ~ export FloatingPanel
│  ├─ README.md                          ~ menu groups, icons, FloatingPanel, log slider
│  └─ kit/
│     ├─ kit.types.ts                    ~ MenuItem: icon, group
│     ├─ MenuList.tsx                    ~ draws icons and dashed group rules
│     ├─ ContextMenu.tsx                 ~ stays on screen; items get the click point
│     ├─ SliderField.tsx                 ~ log scale
│     └─ FloatingPanel.tsx               + panel anchored to a screen box
├─ modules/
│  ├─ project/
│  │  ├─ index.ts                        ~ export speed helpers and ClipSpeed
│  │  ├─ project.types.ts                ~ Clip.disabled, Clip.speed, ClipSpeed, duration comment
│  │  ├─ project.selectors.ts            ~ followsFileTime: a hold has no time of its own
│  │  ├─ README.md                       ~ speed value, sourceTimeAt
│  │  └─ logic/
│  │     ├─ speed.ts                     + DEFAULT_SPEED, speedOf, sourceSpan, sourceTimeAt, canChangeSpeed
│  │     └─ speed.test.ts                + time mapping
│  ├─ timeline/
│  │  ├─ index.ts                        ~ export new commands and types
│  │  ├─ timeline.types.ts               ~ menu entry, clipboard and menu context types
│  │  ├─ timeline.store.ts               ~ per-actor clipboard
│  │  ├─ timeline.commands.ts            ~ lists the new commands
│  │  ├─ timeline.clip.commands.ts       ~ linkClips, setClipsDisabled
│  │  ├─ timeline.split.commands.ts      ~ splitClips and removeClips helpers, rippleDelete, speed in split
│  │  ├─ timeline.clipboard.commands.ts  + copy, cut, paste, duplicate
│  │  ├─ timeline.clipboard.test.ts      + paste placement and links
│  │  ├─ timeline.menu.ts                + the clip and timeline menu items timeline owns
│  │  ├─ timeline.mcp.ts                 ~ the new tools
│  │  ├─ timeline.module.ts              ~ contributes menus, keybindings, Edit menu entries
│  │  ├─ timeline.commands.test.ts       ~ ripple delete, disable, link
│  │  ├─ README.md                       ~ commands, points, Not yet
│  │  ├─ logic/
│  │  │  ├─ menu.ts                      + arrangeMenu
│  │  │  ├─ paste.ts                     + pastePlan
│  │  │  ├─ ripple.ts                    + rippleDeleteMoves
│  │  │  ├─ placement.ts                 ~ clampTrim at a rate
│  │  │  └─ placement.test.ts            ~ trim at a rate
│  │  └─ ui/
│  │     ├─ TimelineClip.tsx             ~ selects on right click, dimmed when disabled, speed label
│  │     └─ TimelinePanel.tsx            ~ passes the click spot to menu items
│  ├─ composition/
│  │  ├─ composition.module.ts           ~ groups on its items, click spot on its menu
│  │  └─ README.md                       ~ menu groups
│  ├─ transform/
│  │  ├─ transform.module.ts             ~ Reset transform item
│  │  └─ README.md                       ~ contribution
│  ├─ audio/
│  │  ├─ audio.module.ts                 ~ Reset sound item, requires timeline
│  │  └─ README.md                       ~ contribution, Not yet on speed
│  ├─ media/
│  │  ├─ index.ts                        ~ export revealMedia, reversed API
│  │  ├─ media.commands.ts               ~ media.reveal
│  │  ├─ media.types.ts                  ~ reversed API
│  │  ├─ media.service.ts                ~ media_prepare_reversed
│  │  ├─ media.testing.ts                ~ fake reversed API
│  │  ├─ media.module.ts                 ~ wires the reversed API
│  │  └─ README.md                       ~ reveal, reversed copies
│  ├─ preview/
│  │  ├─ engine/engine.html.ts           ~ sourceTimeAt, rate, disabled, reversed element time
│  │  ├─ engine/engine.slots.ts          ~ rate on acquire, reset on reuse, reversed url
│  │  ├─ engine/engine.types.ts          ~ reversedUrl option
│  │  ├─ preview.types.ts                ~ DriftState.rate
│  │  ├─ logic/frame.ts                  ~ skips disabled clips
│  │  ├─ logic/junctions.ts              ~ a disabled side counts as absent
│  │  ├─ logic/drift.ts                  ~ limits scale with the rate
│  │  ├─ logic/drift.test.ts             ~ drift at 4x
│  │  └─ README.md                       ~ speed, disabled clips
│  ├─ export/
│  │  ├─ export.types.ts                 ~ SoundSegment: speed, keepPitch, reversed
│  │  ├─ export.runner.ts                ~ prepares reversed masters
│  │  ├─ logic/mixdown.ts                ~ disabled clips, file time, rate
│  │  ├─ logic/mixdown.test.ts           ~ speed and disabled segments
│  │  ├─ logic/sources.ts                ~ skips disabled clips
│  │  └─ README.md                       ~ speed in the mix
│  ├─ inspector/
│  │  └─ README.md                       ~ new section in the Video tab
│  └─ speed/                             + the new feature module
│     ├─ index.ts                        +
│     ├─ speed.ref.ts                    +
│     ├─ speed.types.ts                  +
│     ├─ speed.module.ts                 +
│     ├─ speed.commands.ts               + speed.set, speed.reset, speed.freezeFrame
│     ├─ speed.commands.test.ts          + retime, ripple, junctions, freeze
│     ├─ speed.mcp.ts                    +
│     ├─ speed.view.store.ts             + box clip and remembered ripple
│     ├─ speed.menu.ts                   + Speed... and Freeze frame items
│     ├─ README.md                       +
│     ├─ logic/retime.ts                 + the new layout for a rate
│     ├─ logic/timecode.ts               + parseTimecode
│     └─ ui/
│        ├─ index.ts                     +
│        ├─ speed.edit.hook.ts           + live drag, one command on release
│        ├─ SpeedFields.tsx              + slider, presets, duration, switches
│        ├─ SpeedBox.tsx                 + the box above the clip
│        ├─ SpeedSection.tsx             + the inspector section
│        └─ TimecodeField.tsx            + the editable duration
├─ app/
│  └─ bootstrap.ts                       ~ lists speedModule
src-tauri/src/
├─ lib.rs                                ~ registers media_prepare_reversed
├─ export/recipe.rs                      ~ tempo step, areverse
└─ media/
   ├─ mod.rs                             ~ declares reversed
   ├─ commands.rs                        ~ media_prepare_reversed
   ├─ registry.rs                        ~ reversed paths per id
   ├─ server.rs                          ~ serves ?reversed=1
   └─ reversed.rs                        + reversed copies in segments
docs/
├─ modules.md or module tables           ~ only if they list modules
└─ superpowers/specs/
   └─ 2026-11-02-speed-preview-check.md  + what the WebKitGTK check found
CLAUDE.md                                ~ scope, Where to look, rule 13
```

`workspace/logic/format.ts` needs no edit: clips are `z.looseObject`.

---

# Part 1: the clip menu

### Task 1: The menu kit and the clip menu point

**Files:**

- Modify: `src/ui/kit/kit.types.ts`, `MenuList.tsx`, `ContextMenu.tsx`
- Modify: `src/modules/timeline/timeline.types.ts`, `timeline.module.ts`, `index.ts`
- Modify: `src/modules/timeline/ui/TimelineClip.tsx`, `ui/TimelinePanel.tsx`
- Modify: `src/modules/composition/composition.module.ts`, `src/modules/transform/transform.module.ts`, `src/modules/audio/audio.module.ts`
- Create: `src/modules/timeline/logic/menu.ts`, `src/modules/timeline/timeline.menu.ts`

**Interfaces:**

- Produces: `MenuItem` gains `icon?: ComponentType<{ className?: string }>` and `group?: string`.
- Produces: `ContextMenu.items` may be `(point: { clientX: number; clientY: number }) => readonly MenuItem[]`.
- Produces in `timeline.types.ts`:

```ts
export type ClipMenuGroup =
  "clipboard" | "timing" | "edit" | "reset" | "composition" | "library" | "delete";
export interface ClipMenuEntry extends Omit<MenuItem, "group"> {
  group: ClipMenuGroup;
  /** Lower comes first within the group. Defaults to 0. */
  order?: number;
}
// ClipActions.items?(clip: Clip): ClipMenuEntry[]
// TimelineMenuItems.items(at: DropTarget | null): MenuItem[]
```

- Produces: `arrangeMenu(entries: readonly ClipMenuEntry[]): MenuItem[]` in `logic/menu.ts`, sorted by the group order above, then `order`.
- Produces: `clipMenu(ctx): ClipActions` in `timeline.menu.ts` (a factory taking what the wiring gives it, so `timeline.module.ts` stays wiring only).

- [ ] **Step 1: Add `icon` and `group` to `MenuItem`.** `MenuList` draws the icon as `size-3.5 text-muted-foreground` before the label, and a `border-t border-dashed border-border-strong` rule when an entry's `group` differs from the previous one's. An entry without `group` draws no rule, so existing menus don't change.

- [ ] **Step 2: Keep `ContextMenu` on screen.** After the panel mounts, a `useLayoutEffect` clamps `left` and `top` to the window with a 6 px margin, as `Popover` does. Pass the event's `clientX` and `clientY` to a function `items`.

- [ ] **Step 3: Right click selects.** In `TimelineClip`, the `items` function calls `timeline.selectClip(clip.id)` first when the selection doesn't include the clip, then returns `arrangeMenu(actions.flatMap(...))`.

- [ ] **Step 4: Pass the click spot.** `TimelinePanel` gives `menus.flatMap((menu) => menu.items(timeline.dropTarget(clientX, clientY)))`. Composition ignores it for now.

- [ ] **Step 5: Add the existing commands as items.**
  - `timeline.menu.ts`, ids `timeline.clip`: Split at playhead (`edit`, shown when the playhead is inside the clip, shortcut `S`), Unlink audio (`edit`, when the clip has a `linkId`), Delete (`delete`, destructive, shortcut `Del`).
  - composition: `composition` group on its two items.
  - transform: Reset transform (`reset`) for clips where the transform group applies.
  - audio: Reset sound (`reset`), when the clip or its partner has `sound`; add `timeline` to `requires`.

  Items act on `timeline.view.getState().selection`. Icons: `SquareSplitHorizontal`, `Unlink`, `Trash2`, `RotateCcw`, `Volume2`, `Group`, `Copy`.

- [ ] **Step 6: Verify.** Run `pnpm typecheck && pnpm lint && pnpm test`. Expected: all pass.

- [ ] **Step 7: Check in the app.** Run `pnpm tauri dev`. Right-click an unselected clip: it's selected, the menu shows groups and stays on screen near the window's corner. Bin and composition tile menus still work.

- [ ] **Step 8: Commit.** `git commit -m "feat(timeline): clip menu with groups, icons and the tools that exist"`

### Task 2: Ripple delete, disable and link

**Files:**

- Modify: `src/modules/timeline/timeline.split.commands.ts`, `timeline.clip.commands.ts`, `timeline.commands.ts`, `timeline.mcp.ts`, `timeline.menu.ts`, `index.ts`
- Modify: `src/modules/project/project.types.ts`, `src/modules/preview/logic/frame.ts`, `src/modules/preview/logic/junctions.ts`, `src/modules/export/logic/mixdown.ts`, `src/modules/export/logic/sources.ts`, `src/modules/timeline/ui/TimelineClip.tsx`
- Create: `src/modules/timeline/logic/ripple.ts`
- Test: `src/modules/timeline/timeline.commands.test.ts`, `src/modules/export/logic/mixdown.test.ts`

**Interfaces:**

- Produces: `Clip.disabled?: true`.
- Produces: `rippleDeleteMoves(state: ProjectState, doomed: ReadonlySet<ClipId>): ClipMove[]`.
- Produces: commands `rippleDelete` (`timeline.rippleDelete`, `{ clipIds }`, returns `{ deleted, removedJunctions }`), `setClipsDisabled` (`timeline.setClipsDisabled`, `{ clipIds, disabled }`), `linkClips` (`timeline.linkClips`, `{ clipIds }`, returns `{ linkId }`). Tools `timeline_ripple_delete`, `timeline_set_clips_disabled`, `timeline_link_clips`.
- Produces: `removeClips(ctx, state, ids): { deleted: number; removedJunctions: JunctionId[] }`, the body of `deleteClips` moved into a helper, for Task 3.

- [ ] **Step 1: Write the failing tests** in `timeline.commands.test.ts`:

```ts
it(
  "ripple delete closes the clip's length" /* a[0,10] b[10,15] c[15,20]; delete b → c.start 10s */,
);
it(
  "ripple delete with a junction closes only the freed time",
  /* A[0,10] B[9,15] joined, D[15,20]; delete B → D.start 10s, no conflict */
);
it(
  "ripple delete keeps gaps that were already there",
  /* a[0,5] b[8,10] c[12,14]; delete b → c.start 10s */
);
it("ripple delete adds up on a track" /* delete two of four → last moves by both lengths */);
it("ripple delete moves a linked pair by the smaller shift and keeps it in sync");
it("ripple delete changes nothing when the shift would overlap" /* code timeline.overlap */);
it("disable marks linked partners and stores nothing when enabled");
it(
  "link restores an unlinked pair" /* unlink then link → same linkId on both, partnersOf finds them */,
);
it("link refuses another file or other timing" /* code timeline.link_mismatch */);
```

In `mixdown.test.ts`: `it("leaves out disabled clips")`.

- [ ] **Step 2: Run them.** `pnpm vitest run src/modules/timeline/timeline.commands.test.ts`. Expected: FAIL, the commands don't exist.

- [ ] **Step 3: Implement `rippleDeleteMoves`.** The algorithm:

```text
for each track that loses a clip:
  freed spans = each doomed clip's [start, end) minus the union of the track's other clips
  for each kept clip after them: shift = total freed length ending at or before clip.start
groupShift(clip) = the smallest shift among clip and its partners that have one
partners on untouched tracks take the group's shift
return moves for every clip with shift > 0
```

- [ ] **Step 4: Implement the commands.** `rippleDelete`: compute moves on the state, remove the clips and their junctions in a `produce`, `applyMoves`, `followMove`, `checkLayout`, `commitState`. `setClipsDisabled` uses `withPartners`, sets `true` or deletes the field. `linkClips` needs exactly one video-track and one audio-track clip, unlinked, same `mediaId`, `start`, `duration`, `sourceIn`, else `timeline.link_mismatch`, and sets one `createId("link")`.

- [ ] **Step 5: Skip disabled clips.** In `resolveLevel` (`frame.ts`) `continue` on `clip.disabled`, in `walk` (`mixdown.ts`) return, in `usedMedia` (`sources.ts`) continue. Then read `preview/logic/junctions.ts`: `activeJunctions` resolves both clips from the project, so it must treat a disabled side as absent, so the visible clip plays through against nothing.

- [ ] **Step 6: Add menu items and dimming.** Ripple delete (`delete`, destructive, `ArrowLeftToLine`), Disable clip or Enable clip (`edit`, `EyeOff`), Link audio (`edit`, `Link`, when the selection is one video and one audio clip, unlinked; `disabled: true` if they don't match). `TimelineClip`: `opacity-40` when `clip.disabled`.

- [ ] **Step 7: Run the tests.** `pnpm vitest run src/modules/timeline src/modules/export`. Expected: PASS.

- [ ] **Step 8: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`, then `git commit -m "feat(timeline): ripple delete, disable clip and link audio"`

### Task 3: Clipboard

**Files:**

- Create: `src/modules/timeline/timeline.clipboard.commands.ts`, `logic/paste.ts`, `timeline.clipboard.test.ts`
- Modify: `timeline.types.ts`, `timeline.store.ts`, `timeline.commands.ts`, `timeline.mcp.ts`, `timeline.menu.ts`, `timeline.module.ts`, `index.ts`

**Interfaces:**

- Consumes: `removeClips` from Task 2. `contains` from `project`.
- Produces in `timeline.types.ts`:

```ts
export interface ClipboardEntry {
  /** Copies of the clips and their partners. */
  clips: readonly Clip[];
  /** Earliest start among them. */
  origin: Micros;
}
// TimelineApi.clipboard: { get(actor: ActorId): ClipboardEntry | undefined; set(actor, entry): void }
```

- Produces: `pastePlan(state, entry, { time, trackId }): { clips: Clip[]; newTracks: TrackKind[] }`, pure, with ids from `createId`.
- Produces: commands `copyClips`, `cutClips`, `pasteClips` (`{ time?, trackId? }`, returns `{ clips }`), `duplicateClips` (`{ clipIds }`). Tools `timeline_copy_clips`, `timeline_cut_clips`, `timeline_paste_clips`, `timeline_duplicate_clips`.

- [ ] **Step 1: Write the failing tests** in `timeline.clipboard.test.ts`, with the setup of `timeline.commands.test.ts`:

```ts
it("paste keeps spacing and gives new ids");
it("paste keeps a linked pair linked under a new linkId");
it("paste goes to the first free track of its kind when the original is taken");
it("paste makes a new track when none has room, and one undo removes clips and track");
it("trackId anchors the first clip, the rest keep their distance in tracks");
it("an agent's copy doesn't replace the local actor's");
it("cut is one undo step");
it("duplicate lands right after the selection");
it("paste refuses a composition into one it contains" /* code composition.cycle */);
it(
  "paste fails when the copied media is gone" /* code timeline.clipboard_stale, nothing written */,
);
it("copy with nothing copied before fails paste" /* code timeline.clipboard_empty */);
```

- [ ] **Step 2: Run them.** `pnpm vitest run src/modules/timeline/timeline.clipboard.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the clipboard in `createTimelineView`:** a `Map<ActorId, ClipboardEntry>` inside the closure.

- [ ] **Step 4: Implement `pastePlan`.** Offset every clip by `time - origin`. Tracks: use the original track when it's in the target composition and free (`findOverlap`), else `freeTrack`, else a new track of that kind. With `trackId`, anchor as the test states. New `linkId`s by old link. `speed`, `sound`, `transform` and `props` are `structuredClone`d. Junctions aren't copied.

- [ ] **Step 5: Implement the commands.** `copyClips` is `undoable: false` and reads `withPartners`. `pasteClips` takes `time` default `playback.getTime()`, checks each clip's `mediaId` or `compositionRef` still exists (`timeline.clipboard_stale`) and `contains` (`composition.cycle`), creates tracks as `addElement` does, and adds everything in one `ctx.mutate`. `duplicateClips` builds an entry from the clips without touching the clipboard, and pastes at the end of the selection.

- [ ] **Step 6: Add menu items and shortcuts.** Clipboard group: Cut, Copy, Paste (shown when `clipboard.get(LOCAL_ACTOR)` exists), Duplicate, icons `Scissors`, `Copy`, `ClipboardPaste`, `CopyPlus`, shortcuts `Ctrl+X/C/V/D`. Clip menu Paste uses the playhead. `timelineMenuItems` entry `timeline.paste`: Paste at `at.time` on `at.trackId`, when `at` isn't null and the clipboard has clips. Keybindings `timeline.copy`, `.cut`, `.paste`, `.duplicate` with `mod: true`, each `resolve` returning null unless `pages.store.getState().active === EDITOR_PAGE` and (except paste) the selection isn't empty. Edit menu entries through `appMenuItems`, as Split has.

- [ ] **Step 7: Add the page test** to `timeline.clipboard.test.ts`: `it("the copy shortcut does nothing off the Edit page")`, resolving the `timeline.copy` keybinding with the active page set to `MEDIA_PAGE`. Expected: `null`.

- [ ] **Step 8: Run the tests.** `pnpm vitest run src/modules/timeline`. Expected: PASS.

- [ ] **Step 9: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`, then `git commit -m "feat(timeline): cut, copy, paste and duplicate"`

### Task 4: Show in Library, docs and the manual pass

**Files:**

- Modify: `src/modules/media/media.commands.ts`, `index.ts`, `src/modules/timeline/timeline.menu.ts`
- Modify READMEs: `src/ui`, `timeline`, `composition`, `transform`, `audio`, `media`, `preview`, `export`

**Interfaces:**

- Produces: `revealMedia` (`media.reveal`, `{ mediaId }`, `undoable: false`), no MCP tool.

- [ ] **Step 1: Implement `revealMedia`.** Set the library view to `{ place: { kind: "bin", binId: asset.binId ?? null }, search: "", selection: [mediaId] }` and show `MEDIA_PAGE` through the `pages` store's command. Fail `media.not_found` for an unknown id.

- [ ] **Step 2: Add Show in Library** (`library`, `FolderSearch`) for a single clip with a `mediaId`.

- [ ] **Step 3: Update the READMEs**, including the command tables and `timeline`'s Not yet (ripple delete is no longer missing).

- [ ] **Step 4: Manual pass in `pnpm tauri dev`.** Every item in the spec's menu table, on a linked pair, a text clip, a composition clip and a multi-selection. Paste from the empty timeline lands at the click. Disabled clip is gone from preview and from a short export.

- [ ] **Step 5: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`, then `git commit -m "feat(media): show a clip's file in the library"`

---

# Part 2: clip speed

### Task 5: Stage 0, the playback check (gate)

**Files:**

- Create: `docs/superpowers/specs/2026-11-02-speed-preview-check.md`

No product code. Any harness stays out of the repo, in the scratchpad.

- [ ] **Step 1: Measure on WebKitGTK.** In `pnpm tauri dev`, with a throwaway page or console, play a proxy at `0.1, 0.5, 2, 4, 10` and record whether picture and sound stay smooth, whether `requestVideoFrameCallback` keeps firing, and whether `preservesPitch` changes the sound.

- [ ] **Step 2: Write the findings**, in the format of `2026-11-02-audio-preview-check.md`.

- [ ] **Step 3: Decide.** If `preservesPitch` works, go on. If not, Task 8 routes pitch correction through the worklet in `engine.audiograph.ts`. If neither holds up at high speeds, **stop and bring it back to the user.**

- [ ] **Step 4: Commit.** `git commit -m "docs(speed): what the playback check on WebKitGTK found"`

### Task 6: The value and the time function

**Files:**

- Create: `src/modules/project/logic/speed.ts`, `speed.test.ts`
- Modify: `src/modules/project/project.types.ts`, `index.ts`, `src/modules/preview/engine/engine.html.ts`, `src/modules/timeline/timeline.split.commands.ts`, `logic/placement.ts`, `logic/placement.test.ts`, `src/modules/timeline/timeline.clip.commands.ts`

**Interfaces:**

- Produces:

```ts
export interface ClipSpeed {
  /** 0.1 to 10; 0 holds one frame (Freeze frame). */
  rate: number;
  pitchCorrection: boolean;
  reversed: boolean;
}
// Clip.speed?: ClipSpeed
export const DEFAULT_SPEED: ClipSpeed; // { rate: 1, pitchCorrection: true, reversed: false }
export function speedOf(clip: Pick<Clip, "speed">): ClipSpeed;
/** The part of the file a clip uses, in file time. */
export function sourceSpan(clip: Pick<Clip, "duration" | "speed">): Micros;
/** Forward file time at a timeline time. Clamped to the clip's span. */
export function sourceTimeAt(
  clip: Pick<Clip, "start" | "sourceIn" | "duration" | "speed">,
  time: Micros,
): Micros;
/** Whether speed can change on this clip: a file's time, and not a hold. */
export function canChangeSpeed(state: Pick<ProjectState, "media">, clip: Clip): boolean;
export function sameSpeed(a: Clip, b: Clip): boolean;
```

- [ ] **Step 1: Write the failing tests** in `speed.test.ts`:

```ts
it(
  "maps time at 1x exactly as before" /* sourceTimeAt({start:5s,sourceIn:2s,duration:4s}, 6s) === 3s */,
);
it("maps time at 2x" /* same clip with rate 2 at 6s === 4s */);
it("gives integer micros at 3x");
it("sourceSpan is duration times rate" /* 4s at 2x === 8s */);
it("a hold stays on one frame" /* rate 0, any time === sourceIn */);
```

In `placement.test.ts`:

```ts
it("end trim stops at the end of the file at 2x" /* sourceIn 0, media 10s → clip can't pass 5s */);
it("start trim moves sourceIn by delta times the rate" /* start +1s at 2x → sourceIn +2s */);
```

In `timeline.commands.test.ts`: `it("split at 2x moves the right half's sourceIn by twice the offset")`.

- [ ] **Step 2: Run them.** `pnpm vitest run src/modules/project src/modules/timeline`. Expected: FAIL.

- [ ] **Step 3: Implement `speed.ts`**, the only file that multiplies by a rate. The rest call it.

- [ ] **Step 4: Replace the two `clip.sourceIn + … - clip.start` sums in `engine.html.ts`** with `sourceTimeAt`. `frame.ts` and the composition branch of `mixdown.ts` stay, since composition clips have no speed.

- [ ] **Step 5: Update `clampTrim`.** Take `speed` in its `Pick`. Bounds at a rate: `sourceStart = clip.start - sourceIn / rate`, `sourceEnd = clip.start + (mediaDuration - sourceIn) / rate`, `sourceIn + delta * rate`.

- [ ] **Step 6: Update split.** The right half's `sourceIn` is `sourceTimeAt(left, at)`, and both halves keep `speed`. Pull the body into `splitClips(state, at, targets, kindOf): { next, created }`, used here and by Task 10.

- [ ] **Step 7: Add `sameSpeed` to `linkClips`' checks.**

- [ ] **Step 8: Run the tests.** `pnpm vitest run src/modules/project src/modules/timeline`. Expected: PASS.

- [ ] **Step 9: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`, then `git commit -m "feat(project): clip speed and one function for clip time"`

### Task 7: The speed module and commands

**Files:**

- Create: `src/modules/speed/` : `index.ts`, `speed.ref.ts`, `speed.types.ts`, `speed.module.ts`, `speed.commands.ts`, `speed.commands.test.ts`, `speed.mcp.ts`, `speed.view.store.ts`, `logic/retime.ts`, `README.md`
- Modify: `src/app/bootstrap.ts`, `src/modules/timeline/index.ts` (export `splitClips`, `checkLayout`, `commitState`, `fitJunctions`, `junctionKindOf`, `neighbourBounds` if a feature needs them, rule 8)

**Interfaces:**

- Consumes: `speedOf`, `sourceSpan`, `canChangeSpeed` from Task 6.
- Produces:

```ts
// speed.commands.ts
export const setSpeed; // "speed.set"
// input { clipIds, rate?: 0.1..10, duration?: Micros, pitchCorrection?, reversed?, ripple?: boolean = true }
// exactly one of rate or duration may be set; both may be absent to change only pitchCorrection
// result { clips: { id, rate, duration }[] }
export const resetSpeed; // "speed.reset", input { clipIds, ripple?: boolean = true }
// speed.view.store.ts
export interface SpeedView {
  boxClipId: ClipId | null;
  ripple: boolean;
}
// logic/retime.ts
export function retime(
  state,
  group: ClipId[],
  rate,
  ripple,
  kindOf,
): { state: ProjectState; rate: number };
```

- [ ] **Step 1: Write the failing tests** in `speed.commands.test.ts`:

```ts
it("2x halves the clip and keeps its start and its part of the file");
it("takes a duration and works out the rate");
it("refuses a duration outside the range" /* speed.out_of_range */);
it("linked clips take the same speed in one step");
it("ripple on moves what follows, with partners");
it("ripple on keeps a junction after the clip, and shrinks one that no longer fits");
it("ripple on refuses when something unlinked is in the way" /* timeline.overlap */);
it("ripple off leaves a gap when faster");
it("ripple off stops a slower clip at the next one and returns the rate applied");
it("ripple off refuses a junction on the clip's end" /* speed.joined */);
it("ripple off ignores a junction on the clip's start");
it("refuses text, images and composition clips" /* speed.unsupported */);
it("fades stay within a shorter clip");
it("1x with pitch correction on stores no speed");
it("reset clears speed on the clip and its partner");
it("one undo restores everything");
it("3x then 1x stays inside the file" /* duration within rate µs of the original */);
```

- [ ] **Step 2: Run them.** `pnpm vitest run src/modules/speed`. Expected: FAIL.

- [ ] **Step 3: Scaffold the module** per the new module checklist in `docs/modules.md`: tier `feature`, `requires: ["project", "junction", "timeline", "preview", "inspector"]`, listed in `bootstrap.ts` after `audioModule`.

- [ ] **Step 4: Implement `retime`.**

```text
span = sourceSpan(clip); newDuration = max(one frame, round(span / rate))
ripple off:
  refuse speed.joined if a junction has this clip on its left
  clamp: newDuration <= next clip's start - clip.start; rate = span / newDuration
apply duration (and fades, clamped) to the group
ripple on:
  delta = new end - old end
  for each clip in the group, rippleMoves from the next clip on its track, each clip once
  applyMoves, fitJunctions
checkLayout
```

The group's rate is the slowest clamp of its clips. With several groups, retime them in order of `start` on the running state.

- [ ] **Step 5: Implement the commands and tools.** `speed_set`, `speed_reset`. Descriptions explain ripple and the failure codes. Writing a `ClipSpeed` equal to `DEFAULT_SPEED` deletes the field.

- [ ] **Step 6: Run the tests.** `pnpm vitest run src/modules/speed`. Expected: PASS.

- [ ] **Step 7: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`, then `git commit -m "feat(speed): speed.set and speed.reset with ripple"`

### Task 8: Preview and export

**Files:**

- Modify: `src/modules/preview/engine/engine.html.ts`, `engine.slots.ts`, `logic/drift.ts`, `logic/drift.test.ts`, `src/modules/preview/preview.types.ts` (`DriftState`)
- Modify: `src/modules/export/export.types.ts`, `logic/mixdown.ts`, `logic/mixdown.test.ts`, `src-tauri/src/export/recipe.rs`

**Interfaces:**

- Consumes: `speedOf`, `sourceTimeAt`.
- Produces: `DriftState.rate: number`.
- Produces: `SoundSegment` (TypeScript and Rust) gains `speed?: number` (missing is 1) and `keepPitch?: boolean` (missing is true). `from` is in file time and `duration` stays timeline time.

- [ ] **Step 1: Write the failing tests.**

```ts
// drift.test.ts
it("tolerates more drift at 4x and aims further ahead");
// mixdown.test.ts
it(
  "gives a 2x clip its file time and rate" /* from = sourceIn + skipped * 2, speed 2, duration timeline */,
);
it("a clip at 1x adds no speed field");
```

```rust
// recipe.rs
#[test] fn speed_keeping_pitch_uses_tempo() // speed 2 → ",atempo=2.000000" before effects
#[test] fn speed_past_two_chains_tempo()    // speed 4 → ",atempo=2.000000,atempo=2.000000"
#[test] fn speed_without_correction_resamples() // ",asetrate=96000.000,aresample=48000"
#[test] fn input_reads_duration_times_speed()   // -t 8.000000 for 4 s at 2x
#[test] fn fades_stay_after_the_tempo_step()
```

- [ ] **Step 2: Run them.** `pnpm vitest run src/modules/preview src/modules/export` and `cd src-tauri && cargo test`. Expected: FAIL.

- [ ] **Step 3: Implement drift.** Multiply the limits and `seekCost` by `max(1, rate)`.

- [ ] **Step 4: Set the element's rate.** In `engine.html.ts`, read the speed as `(propsOverrides.get(clip.id)?.speed as ClipSpeed) ?? speedOf(clip)`, beside the same line for `sound`, and use it for `sourceTimeAt`. After `pool.acquire`, set `element.playbackRate` and `preservesPitch` (or the worklet path, per Task 5). `engine.slots.ts`: `playbackRate = 1` when a slot is released. A pitched clip's `PITCH_LEAD_SECONDS` is multiplied by the rate.

- [ ] **Step 5: Implement `mixdown`.** `from: sourceTimeAt(clip, start)`, plus `speed` and `keepPitch` only when they differ from the defaults.

- [ ] **Step 6: Implement `recipe.rs`.** `-t` reads `duration * speed`. A new first step in `effects`: with `keep_pitch`, `tempo_steps(speed)`; without it, `asetrate=SAMPLE_RATE*speed,aresample=SAMPLE_RATE`.

- [ ] **Step 7: Run the tests.** Same commands as Step 2. Expected: PASS.

- [ ] **Step 8: Check by ear.** With an agent or the console, set a talking clip to 2x. Play it, export it, and compare. Pitch correction on and off must match between them.

- [ ] **Step 9: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`, plus clippy and `cargo test`, then `git commit -m "feat(speed): speed in preview and export"`

### Task 9: The box, the section and the menu item

**Files:**

- Create: `src/ui/kit/FloatingPanel.tsx`, `src/modules/speed/ui/*`, `src/modules/speed/speed.menu.ts`, `src/modules/speed/logic/timecode.ts`
- Modify: `src/ui/index.ts`, `src/ui/kit/SliderField.tsx`, `src/modules/speed/speed.module.ts`, `src/modules/timeline/ui/TimelineClip.tsx`

**Interfaces:**

- Consumes: `setSpeed`, `resetSpeed`, `SpeedView`, `preview.previewProps`, `timeline.clipBox`, `timeline.onScroll`.
- Produces: `FloatingPanel({ box: () => ScreenRect | null, side: "top", onClose, children })`. It portals like `Popover`, closes on an outside press or Escape, repositions through `timeline.onScroll` via a `reposition` ref, and calls `onClose` if `box()` returns null. `Popover` isn't changed.
- Produces: `SliderField` gains `scale?: "linear" | "log"`. With `log`, the range runs on `log10(value)`.
- Produces: `parseTimecode(text: string, fps: number): Micros | null`.

- [ ] **Step 1: Add the log scale** to `SliderField` and write `FloatingPanel`.

- [ ] **Step 2: Write `speed.edit.hook.ts`,** following `sound.edit.hook.ts`. Drag: `preview.previewProps(id, { speed })` for the clip and its partner, and the width of `[data-clip-id]` set through the DOM (rule 24). Release: one `setSpeed` with `ripple` from `SpeedView`, then clear the live patch. Failures go to `notify`.

- [ ] **Step 3: Write `SpeedFields`:** `SliderField` (`min 0.1, max 10, scale log`, shown as `2.00x`), a `SegmentedControl` of the presets, `TimecodeField`, and `ToggleRow`s for Ripple timeline and Pitch correction. Values not at their defaults are `text-mark`, as the inspector's `data-changed`. When the clip has a junction on its end and ripple is off, show the reason next to the switch.

- [ ] **Step 4: Write `SpeedBox`,** drawn from `appOverlays` when `boxClipId` is set: `FloatingPanel` above the clip, title `Clip speed` with `Gauge`, then `SpeedFields`. It closes when the clip disappears from the project.

- [ ] **Step 5: Write `SpeedSection`,** contributed to `inspectorSections` with `tab: "video"`, `order: 901`, `appliesTo` from `canChangeSpeed`, and `RotateCcw` running `resetSpeed`.

- [ ] **Step 6: Add the menu item and label.** `speed.menu.ts`: Speed... (`timing`, `Gauge`) sets `boxClipId`. In `TimelineClip`'s label: `<span className="text-mark">{rate.toFixed(2)}x</span>` when the rate isn't 1.

- [ ] **Step 7: Check in the app.** Slider, presets, typed duration, both switches, and undo as one step. The box follows a scrolling timeline. Undo the clip away and the box closes.

- [ ] **Step 8: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`, then `git commit -m "feat(speed): the speed box and the inspector section"`

### Task 10: Freeze frame

**Files:**

- Modify: `src/modules/speed/speed.commands.ts`, `speed.commands.test.ts`, `speed.mcp.ts`, `speed.menu.ts`
- Modify: `src/modules/project/project.selectors.ts`, `src/modules/preview/engine/engine.html.ts`

**Interfaces:**

- Consumes: `splitClips` from Task 6.
- Produces: `freezeFrame` (`speed.freezeFrame`, `{ clipId, at? }`, default the playhead, returns `{ hold }`). Tool `speed_freeze_frame`.

- [ ] **Step 1: Write the failing tests:**

```ts
it("splits at the playhead and inserts a 3 s hold, moving what follows");
it("linked sound gets a gap of the same length");
it(
  "the hold shows the frame at the playhead, at any speed" /* sourceIn = sourceTimeAt(clip, at) */,
);
it("a hold trims to any length and keeps its frame when split");
it("speed.set refuses a hold" /* speed.unsupported */);
it("one undo restores the clip");
```

- [ ] **Step 2: Run them.** `pnpm vitest run src/modules/speed`. Expected: FAIL.

- [ ] **Step 3: Implement.** `followsFileTime` returns false for `rate === 0`. Split keeps `sourceIn` for a hold instead of 0. The command runs `splitClips`, moves the right half on with `rippleMoves`, and inserts a clip with `speed: { ...DEFAULT_SPEED, rate: 0 }`, the left half's `props` and `transform`, no `linkId`, then `checkLayout` and `commitState`. The engine passes `playing && rate > 0` to `syncSlot`.

- [ ] **Step 4: Add the menu item** (`timing`, `Snowflake`), shown for a picture on a video track under the playhead.

- [ ] **Step 5: Run the tests.** `pnpm vitest run src/modules/speed src/modules/timeline`. Expected: PASS.

- [ ] **Step 6: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`, then `git commit -m "feat(speed): freeze frame"`

### Task 11: Reverse

**Files:**

- Create: `src-tauri/src/media/reversed.rs`
- Modify: `src-tauri/src/media/mod.rs`, `commands.rs`, `registry.rs`, `server.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/export/recipe.rs`
- Modify: `src/modules/media/media.types.ts`, `media.service.ts`, `media.testing.ts`, `media.module.ts`, `index.ts`
- Modify: `src/modules/project/logic/speed.ts`, `speed.test.ts`, `src/modules/timeline/timeline.split.commands.ts`, `logic/placement.ts`
- Modify: `src/modules/preview/engine/engine.html.ts`, `engine.slots.ts`, `engine.types.ts`, `src/modules/export/export.runner.ts`, `logic/mixdown.ts`, `src/modules/speed/ui/SpeedSection.tsx`, `speed.commands.test.ts`

**Interfaces:**

- Produces: Rust command `media_prepare_reversed(id, full: bool, on_progress)`, and `?reversed=1` (with `master=1` for full quality) on the media server.
- Produces: `MediaApi.prepareReversed(id, full: boolean, onProgress): Promise<void>`, `reversedUrl(id, full: boolean): string`.
- Produces: `elementTimeAt(clip, time, fileDuration): Micros` in `speed.ts`: `fileDuration - sourceTimeAt(...)` when reversed.
- Produces: `SoundSegment.reversed?: boolean`.

- [ ] **Step 1: Write the failing tests.**

```ts
// speed.test.ts
it("runs backwards through the clip's span when reversed" /* start → end of span */);
it("elementTimeAt mirrors the file when reversed");
// placement.test.ts
it("a reversed clip's start trim keeps sourceIn and its end trim moves it");
// timeline.commands.test.ts
it("split of a reversed clip gives the left half the later part of the file");
// speed.commands.test.ts
it("reversed: true is stored and false isn't");
```

```rust
// reversed.rs
#[test] fn segments_cover_the_file_without_overlap()  // 25 s → [0,10),[10,20),[20,25)
#[test] fn the_joined_list_runs_from_last_to_first()
#[test] fn a_segment_has_one_video_and_one_audio_stream_and_no_timecode()
// recipe.rs
#[test] fn a_reversed_segment_starts_with_areverse()
```

- [ ] **Step 2: Run them.** `pnpm vitest run src/modules/project src/modules/timeline src/modules/speed` and `cargo test`. Expected: FAIL.

- [ ] **Step 3: Implement `sourceTimeAt` and `elementTimeAt` for `reversed`,** then the mirrored `clampTrim` and split.

- [ ] **Step 4: Implement `reversed.rs`.** Reverse 10-second segments with FFmpeg's `reverse,areverse` and join them from last to first with the concat demuxer, under rule 21 (`-dn -write_tmcd 0 -map_metadata -1`). `full: false` follows the proxy's size and `full: true` the master's. Use `ProxyJobs`' encoder semaphore, temporary file plus rename, and `cache_path` with `reversed.mp4` / `reversed.master.mp4`, reporting progress through the channel.

- [ ] **Step 5: Wire the TypeScript side.** Setting `reversed` starts `prepareReversed(id, false)` in the background from the Speed section and the engine's first use. Until it's ready the slot isn't settled, so the engine keeps the previous picture. `acquire` picks `reversedUrl` for reversed clips, and the engine uses `elementTimeAt`. `export.runner.ts` prepares `full: true` beside `prepareMaster`. `mixdown` sets `reversed: true`, and `recipe.rs` puts `,areverse` first.

- [ ] **Step 6: Add Direction to `SpeedSection`:** a `SegmentedControl` of Forward (`ChevronsRight`) and Reverse (`ChevronsLeft`) running `setSpeed` with `reversed`, with a `ProgressBar` while the copy is made.

- [ ] **Step 7: Run the tests.** Same commands as Step 2. Expected: PASS.

- [ ] **Step 8: Check in the app.** Reverse a short clip and a 10-minute clip. Memory stays bounded, preview plays backwards, and export matches.

- [ ] **Step 9: Verify and commit.** `pnpm typecheck && pnpm lint && pnpm test`, plus clippy and `cargo test`, then `git commit -m "feat(speed): reverse through a reversed copy of the file"`

### Task 12: Docs and the last pass

**Files:**

- Modify: `CLAUDE.md`, `src/modules/speed/README.md`, `src/modules/project/README.md`, `src/modules/preview/README.md`, `src/modules/export/README.md`, `src/modules/media/README.md`, `src/modules/inspector/README.md`, `src/modules/audio/README.md`, `src/ui/README.md`, module tables in `docs/`

- [ ] **Step 1: Update `CLAUDE.md`:** scope (speed), Where to look (`speed/`), and rule 13 if a point moved. The READMEs use the template in `docs/modules.md`. `audio`'s Not yet loses the speed note.

- [ ] **Step 2: Prune tests.** Read every test this plan added against rule 3, and delete any that a task didn't list or that no longer earns its place.

- [ ] **Step 3: Verify.** `pnpm typecheck && pnpm lint && pnpm test`, and `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`. Expected: all pass.

- [ ] **Step 4: Commit.** `git commit -m "docs(speed): the module, its tools and the scope of v1"`
