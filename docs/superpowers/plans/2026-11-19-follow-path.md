# Follow Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paths drawn on the canvas (freehand or pen) that any number of picture clips follow, at even speed, with keyable Progress, an offset and Orient along path.

**Architecture:** Paths are document records in `project` (`ProjectState.paths`, like markers); a clip's settings are a new shared group `follow` at `clip.follow`. One pure function in `project`, `followedClip(clip, time, paths)`, replaces `animatedClip` wherever a picture is placed, so the engine, export, canvas, tint picker and text editor agree. A new feature module `path` owns the commands, MCP tools, the group, the inspector picker, the Library section, the overlay and drawing.

**Tech Stack:** TypeScript strict, React 19, Zod, Immer, Zustand, Vitest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-19-follow-path-design.md`

## Global Constraints

- Commits carry **no** `Co-Authored-By` or any Claude attribution line.
- Rule 3: tests only for the kernel and document integrity (placement, undoable commands). Gesture, fitting and UI math get no committed test.
- Rule 23: placement only through `clipPlacement` fed by `followedClip`.
- Rules 4/5/9/10/18/28/29/31: public entry points only, types in `.types.ts`, every export/command/tool has TSDoc, tools are `commandTool` with names starting `path_`.
- A clip without `follow` plays, saves and exports exactly as today.
- Every edit (draw, reshape, attach, detach, delete) is one undo step.
- Positions are output px from the frame's center (same space as `transform.x/y`); angles are degrees clockwise (y down), 0 = pointing right.
- Progress field range −10…10, slider ui 0…1, displayed ×100 as %.
- Update each touched module's README in the template (`docs/modules.md`), and CHANGELOG.md / CHANGELOG.es.md under Unreleased.
- Done = `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## Review Focus

1. A follower dragged on the canvas must not jump on release (the commit subtracts the path's shift) — checked by hand in the app; the subtraction itself is pinned in Task 4.
2. An open path at Progress 1.5 holds its end; a closed one wraps (Task 1 test).
3. Undoing `path.create` after someone attached clips is refused, not leaving a dangling follower (Task 3 test).
4. A file saved with paths opens in this app; one with a dangling `follow` opens with it dropped (Task 2 test).
5. Duplicating / grouping a composition keeps followers following (a copy), never pointing at another composition's path (Task 5 test).

## Files

```
src/modules/project/
  project.types.ts            M  PathId, PathPoint, MotionPath, ClipFollow, PathSample, FollowShift; ProjectState.paths?; SharedGroupValues.follow
  logic/path.ts               C  pathLength, pathPointAt (arc length, cached per path object)
  logic/path.test.ts          C
  logic/follow.ts             C  NO_FOLLOW, followShift, followedClip, bakeFollow, copyFollowedPaths, scalePath
  logic/follow.test.ts        C
  logic/fields.ts             M  diff `paths`, problems: path composition, ≥2 points, follower path exists in its composition
  project.undo.test.ts        M  dangling follower refused
  project.testing.ts          M  seed.paths
  index.ts, README.md         M
src/modules/workspace/logic/format.ts (+ .test.ts)  M  paths schema, version 5 when paths used, drop dangling follow
src/modules/path/             C  new feature module
  index.ts path.ref.ts path.module.ts path.types.ts README.md
  path.group.ts               follow shared group
  path.commands.ts            create, update, remove
  path.follow.commands.ts     attach, detach
  path.commands.test.ts
  path.mcp.ts                 commandTools + path_list
  path.store.ts               view store: selected path, selected point, drawing
  logic/fit.ts                freehand stroke → PathPoint[] (Schneider)
  logic/edit.ts               add/remove point, move point/handle (mirrored unless broken)
  ui/PathPicker.tsx           command control "path-picker"
  ui/PathsSection.tsx         Library section
  ui/PathOverlay.tsx          previewOverlays: show + edit
  ui/path.edit.gesture.ts
  ui/PathDrawing.tsx          drawing overlay (freehand / pen)
  ui/draw.gesture.ts
  ui/index.ts
src/app/bootstrap.ts          M  pathModule
src/modules/preview/logic/frame.ts (+ frame.test.ts)  M  followedClip
src/modules/transform/logic/layers.ts, transform.types.ts, logic/commit.ts, ui/transform.gesture.ts  M  shift
src/modules/tint/tint.pick.ts M
src/modules/text/ui/TextEditor.tsx M
src/modules/keyframe/ui/MotionPath.tsx M  hide for followers
src/modules/composition/      M  library delete, logic/clone.ts, composition.group.command.ts, setSettings resize; tests
src/modules/timeline/timeline.clipboard.commands.ts M  bake on paste into another composition
CHANGELOG.md, CHANGELOG.es.md, READMEs M
```

---

### Task 1: The model and the geometry (`project`)

**Files:** Modify `project.types.ts`, `logic/fields.ts`, `project.testing.ts`, `index.ts`, `README.md`, `project.undo.test.ts`. Create `logic/path.ts`, `logic/path.test.ts`, `logic/follow.ts`, `logic/follow.test.ts`.

**Interfaces — Produces:**

```ts
export type PathId = string;
export interface PathPoint { x: number; y: number; inX: number; inY: number; outX: number; outY: number }
export interface MotionPath { id: PathId; compositionId: CompositionId; name: string; closed: boolean; points: PathPoint[] }
export interface ClipFollow { pathId: PathId; progress: number; orient: boolean }   // SharedGroupValues.follow
export interface PathSample { x: number; y: number; angle: number }
export interface FollowShift { x: number; y: number; rotation: number }
ProjectState.paths?: Record<PathId, MotionPath>
export const NO_FOLLOW: ClipFollow = { pathId: "", progress: 0, orient: false };
export function pathLength(path: MotionPath): number;
export function pathPointAt(path: MotionPath, progress: number): PathSample;
export function followShift(clip: Clip, paths: ProjectState["paths"]): FollowShift | null; // clip already animated
export function followedClip(clip: Clip, time: Micros, paths: ProjectState["paths"]): Clip;  // animatedClip + shift into transform
export function bakeFollow(clip: Clip, paths: ProjectState["paths"], at: Micros): Clip;
export function copyFollowedPaths(draft: Draft<ProjectState>, clipIds: readonly ClipId[], compositionId: CompositionId): void;
export function scalePath(path: MotionPath, kx: number, ky: number): MotionPath;
```

Semantics:

- Segments are cubic Béziers `p[i] → p[i+1]` with controls `p[i] + out`, `p[i+1] + in`; plus last → first when `closed`.
- `pathPointAt`: by arc length (a table of 32 samples per segment, cached in a `WeakMap` keyed by the path object). Open: progress clamped to 0…1. Closed: wrapped (`((p % 1) + 1) % 1`). `angle` = `atan2(dy, dx)` of the derivative, in degrees. A zero-length path gives the first point, angle 0.
- `followShift`: `null` when `clip.follow` is missing, `pathId` is empty or not in `paths`. Otherwise `{ x: point.x, y: point.y, rotation: orient ? angle : 0 }`, with `progress` from `clip.follow.progress`.
- `followedClip`: `animatedClip(clip, time)`; with a shift, the returned clip's `transform` is `clipTransform(animated)` with `x`, `y`, `rotation` increased by it. Rotation is not normalized here.
- `bakeFollow`: shift = `followShift(animatedClip(clip, clampToClip(clip, at)), paths)`. Return the clip without `follow` and without the `follow.progress` / `follow.orient` tracks (drop `animation` when empty). With a shift, add it to the static `transform.x/y/rotation` (write a full `clipTransform`) and to every key of the `transform.x`, `transform.y` and `transform.rotation` tracks. Without one, only remove the follow.
- `copyFollowedPaths`: for each distinct `follow.pathId` of those clips, copy the path (`createId("path")`) with `compositionId`, and repoint those clips to the copy.
- `scalePath`: every `x`, `inX`, `outX` × kx and every `y`, `inY`, `outY` × ky.
- `fields.ts`: add `diffOptional("paths", …, true)`. Problems:
  - `"a path would be left without its composition"`
  - `"a path would have fewer than two points"`
  - `"a clip would follow a missing path"` when `pathId` is set and not in `paths`
  - `"a clip would follow a path of another composition"`
- `project.testing.ts`: `seed.paths`.

- [ ] **Step 1: Write the failing tests.**

`logic/path.test.ts`, with `line` = an open path from (0,0) to (100,0), no handles, and `arc` = (0,0) → (100,0) with `out (0,−100)` and `in (0,−100)`:

- `"a straight path is half way at 0.5"`: `pathPointAt(line, 0.5)` ≈ `{ x: 50, y: 0, angle: 0 }`.
- `"speed is even along a curve"`: for `arc`, the length from 0 to 0.25 equals the length from 0.25 to 0.5. Check with `pathLength` of a sub-sampled polyline, ±1%.
- `"an open path holds its ends"`: `pathPointAt(line, 1.5)` ≈ `{ x: 100, y: 0 }`, and at `-1` ≈ `{ x: 0, y: 0 }`.
- `"a closed path wraps"`: for the closed triangle (0,0)/(100,0)/(0,100), the point at 1.25 equals the point at 0.25.
- `"angle points down a downward segment"`: (0,0) → (0,100) gives `angle` 90.

`logic/follow.test.ts`:

- `"a follower sits at its offset plus the path point"`: a clip with `transform.x = 10`, `follow { pathId: "p", progress: 0.5 }` on `line` gives `followedClip(…).transform.x` = 60.
- `"orient adds the direction to rotation"`: a downward path with `orient: true` and rotation 5 gives 95.
- `"a missing path leaves the clip at its offset"`.
- `"bake keeps the clip where it was"`: `clipTransform(bakeFollow(c, paths, at))` `.x/.y` equal `followedClip(c, at, paths).transform` `.x/.y`. `follow` is undefined and there is no `follow.progress` track.

`project.undo.test.ts`, `"undo that would leave a follower on a missing path is refused"`:

- A creates a path (a mutate adding `paths.p`).
- B mutates a clip to `follow { pathId: "p" }`.
- Undoing A's step returns a conflict, matching how the file's existing refusals are asserted.

- [ ] **Step 2:** Run `pnpm vitest run src/modules/project`. Expected: FAIL, missing exports.
- [ ] **Step 3:** Implement the types, `logic/path.ts`, `logic/follow.ts` and `fields.ts` as specified. Export them from `index.ts` with TSDoc.
- [ ] **Step 4:** Run `pnpm vitest run src/modules/project`. Expected: PASS. Then run `pnpm typecheck`.
- [ ] **Step 5:** Update `project/README.md`: paths, follow, the functions, the problems.
- [ ] **Step 6:** Commit: `git commit -m "feat(project): paths, follow and arc-length placement"`

### Task 2: Project files (`workspace`)

**Files:** Modify `src/modules/workspace/logic/format.ts`, `format.test.ts`, `README.md`.

**Interfaces — Consumes:** `MotionPath`, `ClipFollow` (Task 1).

- `documentSchema` gains `paths: z.record(z.string(), z.looseObject({ id, compositionId, name: z.string(), closed: z.boolean(), points: z.array(z.looseObject({ x, y, inX, inY, outX, outY: z.number() })).min(2) })).optional()`.
- The version is 5 when `paths` is non-empty or any clip has `follow`. Otherwise the current rules apply. `VERSION = 5`.
- On decode, `withValidFollows` drops a clip's `follow` (and its `follow.*` tracks) when its path is missing or belongs to another composition, with `log.warn`.

- [ ] **Step 1: Write the failing tests.**
  - `"a project with paths round-trips at version 5"`.
  - `"a dangling follow is dropped on open"`: the decoded clip has no `follow`.
- [ ] **Step 2:** Run `pnpm vitest run src/modules/workspace/logic/format.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Update the README and commit: `git commit -m "feat(workspace): save paths, version 5"`

### Task 3: The `path` module: group, commands, tools

**Files:** Create `path.ref.ts`, `path.types.ts`, `path.module.ts`, `index.ts`, `path.group.ts`, `path.commands.ts`, `path.follow.commands.ts`, `path.mcp.ts`, `path.commands.test.ts`, `README.md`. Modify `src/app/bootstrap.ts`.

**Interfaces — Consumes:** Task 1 functions; `setKey` from `@/modules/keyframe`. **Produces:** the commands `createPath`, `updatePath`, `removePaths`, `attachPath`, `detachPath`, exported from `index.ts`.

- **Module.**
  - `tier: "feature"`, `requires: ["project", "element", "keyframe", "preview", "media", "inspector"]`. Trim the list to what each task really uses, per rule 9.
  - Contributes `sharedGroups` → `followGroup`.
- **`followGroup`** (`id: "follow"`, `key: "follow"`, `label: "Follow path"`, `order: 910`, `appliesTo: track.kind === "video"`, `defaults: () => ({ ...NO_FOLLOW })`):
  - `pathId: prop.string({ hidden: true, readOnly: true })`
  - `progress: prop.number({ min: -10, max: 10, control: "slider", ui: { min: 0, max: 1, step: 0.001 }, display: { scale: 100, unit: "%" }, label: "Progress" })`
  - `orient: prop.boolean({ label: "Orient along path" })`
  - Layout (tab `"video"`): `{ command: "path.attach", control: "path-picker", label: "Path" }`, `"progress"`, `"orient"`. The picker control arrives in Task 6. Until then, check whether the layout tolerates a missing control; if it doesn't, add the layout item in Task 6.
- **`path.create`**:
  - Input: `{ compositionId?, name?, closed: boolean = false, points: PathPoint[] (min 2), attach?: string[] }`.
  - Behavior: the default composition is `view.requireOpen(ctx.actor)`, and the default name is `Path N`, with N = 1 + the count in that composition. With `attach`, it runs `ctx.execute(attachPath, { clipIds: attach, pathId })`.
  - Returns `{ pathId }`.
  - Errors: `path.composition_not_found`, `path.too_few_points` (Zod min also covers it).
- **`path.update`**:
  - Input: `{ pathId, points?, name?, closed? }`.
  - Errors: `path.not_found`, `path.nothing`.
- **`path.remove`**:
  - Input: `{ pathIds: string[] (min 1), at? }`.
  - Behavior: all or none (`path.not_found`). In one `ctx.mutate`, every follower is replaced by `bakeFollow(clip, paths, at ?? actor playhead)` and the path is deleted.
- **`path.attach`**:
  - Input: `{ clipIds (min 1), pathId }`.
  - Validates every clip first: `path.clip_not_found`, `path.not_picture` (not a video track), `path.not_found`, `path.other_composition`.
  - Then, for each clip, one mutate sets `follow = { ...NO_FOLLOW, ...clip.follow, pathId }` and `transform.x = transform.y = 0`, writing a full `clipTransform`.
  - Then, for clips without a `follow.progress` track, it runs `ctx.execute(setKey, …)` twice: at `clip.start` with value 0, and at `clipEnd(clip) - frameDuration(format)` with value 1. This is all one undo entry.
  - Returns `{ clipIds }`.
- **`path.detach`**:
  - Input: `{ clipIds, at? }`.
  - Behavior: `bakeFollow` at `at ?? actor playhead`. A clip without a follow is skipped. Unknown ids fail with `path.clip_not_found`.
- **`path.mcp.ts`**:
  - `commandTool` for each: `path_create`, `path_update`, `path_remove`, `path_attach`, `path_detach`.
  - `path_list` (`defineMcpTool`, read): `{ compositionId? }` → `[{ id, name, closed, points, followers: clipId[] }]`.
- **The `follow.pathId` route.** `element.setProps` already refuses it (`readOnly`). The only change there is a note in the README.

- [ ] **Step 1: Write the failing tests** in `path.commands.test.ts`, seeded through `project.testing.ts` with the module loaded as in `marker.commands.test.ts`:
  - `"attach keys progress at the clip's ends and zeroes the position"`: two keys, values 0 and 1. `transform.x` is 0.
  - `"attach keeps existing progress keys"`.
  - `"attach to another composition's path fails and changes nothing"`: `path.other_composition`.
  - `"remove bakes followers in one step"`: after `path.remove`, the follower's placed x at `at` equals its `followedClip` x before the remove. One `history.undo` restores both.
  - `"create with attach is one undo step"`.
- [ ] **Step 2:** Run `pnpm vitest run src/modules/path`. Expected: FAIL.
- [ ] **Step 3:** Implement and register `pathModule` in `bootstrap.ts`.
- [ ] **Step 4:** Run `pnpm vitest run src/modules/path && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5:** README (template: commands table, tools, invariants). Commit: `git commit -m "feat(path): paths, follow group, commands and tools"`

### Task 4: Every placement uses `followedClip`

**Files:**

- `preview/logic/frame.ts` and `frame.test.ts`
- `transform/logic/layers.ts`, `transform/transform.types.ts` (`VisibleLayer.shift?: FollowShift`), `transform/logic/commit.ts`, `transform/ui/transform.gesture.ts`
- `tint/tint.pick.ts`
- `text/ui/TextEditor.tsx`
- `keyframe/ui/MotionPath.tsx`
- READMEs of preview, transform, tint, text and keyframe

- `frame.ts`: both `animatedClip(clip, t)` calls become `followedClip(clip, t, project.paths)`.
- `layers.ts`: use `followedClip(saved, time, state.paths)`, and set `shift = followShift(animatedClip(saved, time), state.paths) ?? undefined` on the layer. The live transform still goes over the resolved one; live values are in resolved space.
- `commit.ts`: add `export function unshift(t: ClipTransform, shift: FollowShift | undefined): ClipTransform` (`x − shift.x`, `y − shift.y`, `rotation − shift.rotation`). The gesture's `finish` calls `transformPatch(unshift(start, shift), unshift(current, shift), fields)`.
- `tint.pick.ts` and `TextEditor.tsx`: use `followedClip`. The editor reads `paths` from the project store.
- `MotionPath.tsx` (keyframe): render nothing when the selected clip has `follow?.pathId`.

- [ ] **Step 1: Write the failing test** in `preview/logic/frame.test.ts`, `"a follower is drawn on its path"`: the resolved clip's `transform.x` equals offset + path point.
- [ ] **Step 2:** Run `pnpm vitest run src/modules/preview/logic/frame.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement all the call sites above.
- [ ] **Step 4:** Run `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5:** Update the READMEs. Commit: `git commit -m "feat: followers placed on their path everywhere"`

### Task 5: Compositions and the clipboard

**Files:**

- `composition/composition.library.commands.ts` (delete)
- `composition/logic/clone.ts` (duplicate and Make unique both go through it)
- `composition/composition.group.command.ts`
- the setSettings resize path (where `resize.ts` is applied to clips)
- `timeline/timeline.clipboard.commands.ts`
- tests next to them, and READMEs

- Delete: remove the composition's paths, like its markers.
- `cloneComposition`: after the clips are copied, run `copyFollowedPaths(draft, copiedClipIds, id)`. This also copies paths no clip follows: copy every path of the original composition first, then repoint, so an unused path is kept too.
- Group: after the clips move, run `copyFollowedPaths(draft, movedClipIds, newCompositionId)`. The new composition takes `home.format`, so no scaling is needed.
- Resize: each path of the composition becomes `scalePath(path, kx, ky)`, with the same `kx`/`ky` as `resize.ts` uses for x/y.
- Paste: a pasted clip whose `follow.pathId` isn't a path of the target composition is replaced by `bakeFollow(clip, state.paths, clip.start)` before writing.

- [ ] **Step 1: Write the failing tests** (composition and timeline command tests):
  - `"duplicating a composition copies its paths and followers follow the copy"`
  - `"grouping followers keeps them following a copied path"`
  - `"resizing scales path points"`
  - `"pasting a follower into another composition bakes it"`
- [ ] **Step 2:** Run `pnpm vitest run src/modules/composition src/modules/timeline`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm test`. Expected: PASS.
- [ ] **Step 5:** Update the READMEs. Commit: `git commit -m "feat(composition): paths copy, group, resize and paste with their followers"`

### Task 6: Inspector picker and Library section

**Files:** Create `path.store.ts`, `ui/PathPicker.tsx`, `ui/PathsSection.tsx`, `ui/index.ts`. Modify `path.module.ts`, `path.types.ts`, `README.md`.

**Produces:** `PathUi` (Zustand per kernel; `path.types.ts`):

```ts
{
  selectedPathId: PathId | null;
  selectedPoint: number | null;
  drawing: null | { mode: "freehand" | "pen"; attach: string[] };
}
```

It is exposed as `api.ui`.

- **`PathPicker`** (`propertyControls`, `{ id: "path-picker", for: "command" }`):
  - A select listing the clips' composition paths by name, plus "None" and "Draw new path…".
  - A path runs `path.attach`; "None" runs `path.detach` at the playhead.
  - "Draw new path…" sets `ui.drawing = { mode: "freehand", attach: clipIds }`.
  - Its value is the first clip's `follow.pathId`, read from the project store (no React state on per-frame paths). With several clips that differ, it shows "Mixed".
- **`PathsSection`** (`librarySections`, `{ id: "path.section" }`):
  - Title "Paths" and a New path button: `drawing = { mode: "freehand", attach: [] }`.
  - One row per path of the open composition: name (double-click renames with `path.update`), follower count, delete (`path.remove`).
  - Clicking a row sets `selectedPathId`.
  - Kit components only (`Button`, `IconButton`, `EmptyState`); semantic tokens; `rounded-xs`…`rounded-lg`.
- No committed tests (UI).

- [ ] **Step 1:** Implement the store and both components, and contribute them.
- [ ] **Step 2:** Run `pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 3:** Update the README. Commit: `git commit -m "feat(path): path picker and Library section"`

### Task 7: The path on the canvas, editable

**Files:** Create `logic/edit.ts`, `ui/PathOverlay.tsx`, `ui/path.edit.gesture.ts`. Modify `path.module.ts`, `README.md`.

**Produces** (`logic/edit.ts`, pure):

```ts
movePoint(points, i, dx, dy): PathPoint[]                // handles travel with it
moveHandle(points, i, side: "in" | "out", dx, dy, broken: boolean): PathPoint[]  // opposite handle mirrored in direction (keeps its own length) unless broken
insertPoint(path, segment: number, t: number): PathPoint[]  // de Casteljau split, shape unchanged
removePoint(points, i): PathPoint[]                      // refuses below 2: returns the input
```

- **`PathOverlay`** (`previewOverlays`, id `path.overlay`):
  - Shows the path that is `ui.selectedPathId`, or else the path the single selected clip follows.
  - An SVG in the format's `viewBox`, like keyframe's `MotionPath`:
    - a `stroke-primary` line with `vector-effect: non-scaling-stroke`
    - square point handles
    - the selected point's in/out handles as round dots on thin lines
  - DOM only.
- **Gestures** (`path.edit.gesture.ts`):
  - Dragging a point or handle moves it in the DOM. Alt breaks the handle pair.
  - Release sends one `path.update`. Escape cancels; a failure puts it back and calls `notify`.
  - Double-click on the line runs `insertPoint` at the nearest segment and t, then `path.update`.
  - Delete/Backspace while a point is selected (capture phase, skipping text fields, like keyframe's panel) runs `removePoint` then `path.update`.
- No committed tests (gesture). Check `insertPoint` keeps the shape with a throwaway script, then delete it.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS.
- [ ] **Step 3:** Update the README. Commit: `git commit -m "feat(path): edit paths on the canvas"`

### Task 8: Drawing (freehand and pen), docs

**Files:** Create `logic/fit.ts`, `ui/PathDrawing.tsx`, `ui/draw.gesture.ts`. Modify `path.module.ts`, `README.md`, `CHANGELOG.md`, `CHANGELOG.es.md`.

**Produces:** `fitStroke(points: {x: number; y: number}[], tolerance: number): PathPoint[]`. This is Schneider's least-squares cubic fitting:

- Split at the point of maximum error until each piece is within `tolerance`.
- The tangents at the joins are shared, so the joins come out smooth.
- Duplicate input points are removed first.
- A stroke under 2 distinct points returns `[]`.
- `tolerance` = 4 output px × (format width / on-screen frame width).

- **`PathDrawing`** (`previewOverlays`, id `path.drawing`): active while `ui.drawing` is set. It covers the frame, uses a crosshair cursor, and has a small toolbar with Freehand / Pen (`SegmentedControl`) and Done / Cancel.
  - **Freehand:** press, move, release. Points are collected in output px from the frame's center and drawn as a live polyline. On release, if `fitStroke` gives ≥ 2 points, it runs `path.create { points, attach }`.
  - **Pen:**
    - a click adds a corner
    - press-drag sets that point's out handle, with the in handle mirrored
    - clicking the first point (within 8 screen px) closes the path and finishes
    - Enter or double-click finishes
    - Escape cancels
    - finishing with ≥ 2 points runs `path.create { points, closed, attach }`
  - After create it clears `ui.drawing` and selects the new path. A failure calls `notify`.
- **CHANGELOG** (EN and ES, Added, under Unreleased): Follow path (draw freehand or with the pen, many clips on one path, Progress, Orient along path, offset), the Paths section, and the agent tools `path_*`.

- [ ] **Step 1:** Implement. Check `fitStroke` on a sampled semicircle with a throwaway script: ≤ 4 points, max error ≤ tolerance. Delete the script.
- [ ] **Step 2:** Run `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS.
- [ ] **Step 3:** Update the README and changelogs. Commit: `git commit -m "feat(path): draw paths freehand or with the pen"`
