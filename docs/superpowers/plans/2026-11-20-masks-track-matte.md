# Masks and Track Mattes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any picture clip gets ordered masks (presets, pen, freehand; modes, invert, opacity, feather, expansion; every value and every point keyable) and can use another video track as an alpha or brightness matte, drawn identically in preview, capture and export.

**Architecture:** Data and pure geometry live in `project` (`Clip.masks`, `maskOrder`, `matte`; `maskOutline`, `maskPlacement`), as `composite` does. The preview engine cuts a clip's scratch layer with a mask canvas built by `Path2D` and compositing, with Gaussian feather and luma→alpha on the existing GPU runner, and draws matte tracks once per frame before the track loop. A new feature module `mask` owns commands, MCP tools, the key target, the Mask tab, the canvas overlay and the matte badge, reusing `path`'s Bézier editing (moved to `project`) and `transform`'s layers.

**Tech Stack:** TypeScript strict, React 19, Zod, Immer, Zustand, Vitest, WebGL2 through `preview/gpu`. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-19-masks-track-matte-design.md`

## Global Constraints

- Commits carry **no** `Co-Authored-By` or any Claude attribution line.
- Rule 3: tests only for document integrity and undoable commands. Engine, GPU, gesture and UI code get no committed test.
- Rules 4/5/9/10/18/28/29/31: public entry points only; types in `.types.ts`; every export, command and tool has TSDoc; tools are `commandTool(command, { name })` named `mask_*`; `requires` lists exactly what is used.
- A clip without `masks` or `matte` draws, saves and exports exactly as today (file version stays ≤ 5).
- Mask space is **fitted picture space**: output px from the picture's center, the picture as `clipPlacement` fits it at `IDENTITY_TRANSFORM`. Only `maskPlacement` maps it to the frame.
- Ranges: `opacity` 0..1; `feather` 0..2000; `expansion` −2000..2000; `x`, `y` ±100000; `width`, `height` 1..100000; `rotation` normalized like transform's; `roundness` 0..1; star `points` 3..24 (rounded on use); `inner` 0.05..1; path `scale` 0.01..20; a path has ≥ 3 points.
- Modes: `add` | `subtract` | `intersect` | `difference`. Matte `by`: `alpha` | `luma`.
- Every edit is one undo step; a gesture sends one command on release (rule 15); no React state on drag paths (rule 24).
- Failure codes: `mask.clip_not_found`, `mask.not_picture`, `mask.not_found`, `mask.point_not_found`, `mask.animated`, `mask.invalid`, `mask.track_not_found`, `mask.not_video`, `mask.own_track`, `mask.matte_chain`.
- Update each touched module's README (template in `docs/modules.md`) in the task that changes it; CHANGELOG.md and CHANGELOG.es.md under Unreleased in the last task.
- Done = `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

## Review Focus

1. A feathered mask on a proxied video must sit in the same place and softness in the preview and in an export of the master (mask space never reads decoded sizes): checked live in Task 11; the mapping is pinned in Task 1's `maskPlacement` test.
2. Adding a point to an animated pen mask must not change the shape at any existing key time (Task 6 test).
3. Deleting a track that is someone's matte, then undoing, restores both the track and the matte; redo drops it again (Task 1 test).
4. A matte track hidden with the eye still mattes, and export waits for its video frames (Task 7, checked live in Task 11).
5. Grouping a matted clip with its matte clip keeps the matte on the copied track; grouping it alone drops the matte and says so (Task 3 test).

## Files

```
src/modules/project/
  project.types.ts           M  MaskId, PointId, MaskMode, MaskShape, ClipMask, ClipMatte; Clip.masks?, maskOrder?, matte?
  logic/mask.ts              C  MASK_RANGES, maskOutline, maskLine, maskPlacement, scaleMasks
  logic/mask.test.ts         C
  logic/bezier.ts            C  moved from path/logic/edit.ts (segmentAt, segmentCount, movePart, insertPoint, removePoint, nearestOnPath, pathData)
  logic/fit.ts               C  moved from path/logic/fit.ts (fitStroke)
  logic/fields.ts            M  maskProblem in validate; settle drops mattes of deleted tracks
  project.undo.test.ts       M
  project.testing.ts         M  (only if a seed field is needed)
  project.mcp.ts             M  masks and matte in project_get_state
  index.ts, README.md        M
src/modules/path/logic/edit.ts, fit.ts   D  (moved)
src/modules/path/ (ui/*.ts, path.types.ts, index.ts, README.md)  M  import from project; export the gestures
src/modules/workspace/logic/format.ts (+ format.test.ts)  M  version 6, usesMasks
src/modules/speed/speed.commands.ts (+ test)              M  freeze bakes masks
src/modules/timeline/timeline.clipboard.commands.ts (+ test)  M  matte kept or dropped on paste
src/modules/composition/logic/clone.ts, composition.group.command.ts, composition.settings.commands.ts (+ composition.commands.test.ts)  M
src/modules/preview/
  gpu/gpu.mask.ts            C  blurPasses(sigmaX, sigmaY), lumaAlphaPass(invert)
  engine/engine.masks.ts     C  MaskPainter: masks → alpha canvas; mattes per frame
  engine/engine.html.ts      M  cut layer, skip matte tracks, prepare() waits for hidden matte tracks, only skips
  engine/engine.types.ts     M
  README.md                  M
src/modules/transform/ (transform.types.ts, transform.module.ts, logic/layers.ts, ui/TransformOverlay.tsx, index.ts, README.md)  M  hideBox, matte flag, export useVisibleLayers
src/modules/mask/            C  feature module
  index.ts mask.ref.ts mask.module.ts mask.types.ts README.md
  mask.schema.ts             Zod: shape, patch, points
  mask.guards.ts             requireClip, requireMask, requirePicture
  mask.commands.ts           add, update, remove, reorder
  mask.points.commands.ts    setPoints, convert
  mask.matte.commands.ts     setMatte
  mask.keys.ts               key target
  logic/keys.ts              keyed-shape helpers (points at key times)
  mask.commands.test.ts
  mask.mcp.ts                tools + mask_list
  mask.store.ts              createMaskUi
  ui/MaskSection.tsx, ui/MaskPresets.tsx, ui/MaskRow.tsx, ui/MaskFields.tsx, ui/MatteSection.tsx
  ui/MaskOverlay.tsx, ui/mask.paint.ts, ui/mask.box.gesture.ts, ui/MaskDrawing.tsx
  ui/MatteBadge.tsx, ui/index.ts
src/app/bootstrap.ts         M  maskModule
CHANGELOG.md, CHANGELOG.es.md  M
```

---

### Task 1: The model, the geometry and integrity (`project`)

**Files:** Modify `project.types.ts`, `logic/fields.ts`, `project.undo.test.ts`, `project.mcp.ts`, `index.ts`, `README.md`. Create `logic/mask.ts`, `logic/mask.test.ts`.

**Interfaces — Produces:**

```ts
export type MaskId = string;
export type PointId = string;
export type MaskMode = "add" | "subtract" | "intersect" | "difference";
export type MaskShape =
  | { kind: "rectangle"; width: number; height: number; roundness: number }
  | { kind: "ellipse"; width: number; height: number }
  | { kind: "star"; width: number; height: number; points: number; inner: number }
  | { kind: "heart"; width: number; height: number }
  | { kind: "linear" }
  | { kind: "mirror"; width: number }
  | { kind: "path"; scale: number; points: Record<PointId, PathPoint>; pointOrder: PointId[] };
export interface ClipMask {
  id: MaskId;
  name: string;
  color: MarkerColor;
  on?: false;
  mode: MaskMode;
  invert?: true;
  opacity: number;
  feather: number;
  expansion: number;
  x: number;
  y: number;
  rotation: number;
  shape: MaskShape;
}
export interface ClipMatte {
  trackId: TrackId;
  by: "alpha" | "luma";
  invert?: true;
}
// Clip: masks?: Record<MaskId, ClipMask>; maskOrder?: MaskId[]; matte?: ClipMatte
export const MASK_RANGES: Record<string, { min: number; max: number }>; // keys: opacity, feather, expansion, x, y, width, height, roundness, points, inner, scale
export interface MaskMapping {
  cx: number;
  cy: number;
  rotation: number;
  sx: number;
  sy: number;
} // output px; sx/sy signed by flip
export function maskPlacement(
  format: ProjectFormat,
  size: PictureSize,
  transform: ClipTransform,
): MaskMapping;
export function maskOutline(mask: ClipMask): BezierSegment[] | null; // fitted picture px; null for linear/mirror
export function maskLine(
  mask: ClipMask,
): { x: number; y: number; nx: number; ny: number; half: number } | null; // half = mirror half-width, 0 for linear
export function orderedMasks(clip: Pick<Clip, "masks" | "maskOrder">): ClipMask[];
export function scaleMasks(clip: Clip, k: number): Pick<Clip, "masks" | "animation">;
```

Semantics:

- `maskPlacement`: `fitted = clipPlacement(format, size, IDENTITY_TRANSFORM)`, `place = clipPlacement(format, size, transform)`; `{ cx: place.cx, cy: place.cy, rotation: place.rotation, sx: (place.flipX ? -1 : 1) * place.width / fitted.width, sy: … }`. A point `(px, py)` of mask space lands at `rotate((px·sx, py·sy), rotation) + (cx, cy)`.
- `maskOutline`: shape centered at `(mask.x, mask.y)`, rotated by `mask.rotation`; rectangle corners rounded with radius `roundness × min(w, h) / 2` (circular arcs as Béziers, k = 0.5523); ellipse as four Béziers; star with `round(points)` outer points on the ellipse `w × h` and inner ones at `inner ×`, straight segments (handles 0), first outer point straight up; heart as Béziers inside `w × h` (builder's outline); path: each point × `scale`, then rotated and offset, segments closed last → first.
- `maskLine`: linear and mirror through `(x, y)`; the normal points down at rotation 0 (the shown side of linear is the normal's side).
- `scaleMasks(clip, k)`: every `x`, `y`, `width`, `height`, `feather`, `expansion`, path point coordinate and handle × k, and the same for the keys of matching `masks.*` tracks.
- `validate` adds `maskProblem(state)`, messages:
  - `"a clip's mask order would not match its masks"`
  - `"a mask would be out of range"` (`MASK_RANGES`, `mode`, `color`)
  - `"a mask path would have fewer than three points"` / `"a mask path's point order would not match its points"`
  - `"a matte would name a missing track"` / `"a matte would name a track of another composition"` / `"a matte would name an audio track"`
  - masks or matte on a clip of an audio track: `"an audio clip would have masks"`
- `settle`: a clip whose `matte.trackId` is gone loses `matte` (same step), as `listensTo`.
- `project_get_state`: per clip `masks` (ordered `{ id, name, kind, mode, on?, invert? }`) and `matte` when set.

- [ ] **Step 1: Write the failing tests.**

`logic/mask.test.ts`:

```ts
it("maps the fitted picture to the frame regardless of pixel count", () => {
  const f = { width: 1920, height: 1080, fps: 30 };
  const t = { ...IDENTITY_TRANSFORM, scale: 2, scaleX: -1 };
  expect(maskPlacement(f, { width: 960, height: 540 }, t)).toEqual(
    maskPlacement(f, { width: 3840, height: 2160 }, t),
  );
  expect(maskPlacement(f, { width: 960, height: 540 }, t)).toMatchObject({ sx: -2, sy: 2 });
});
it("outlines an ellipse through its four extremes", () => {
  /* x 10, y 20, w 100, h 50 → segment ends at (60,20),(10,45),(-40,20),(10,-5) in some order */
});
it("rounds a star's point count", () => {
  expect(maskOutline(star(5.4))!.length).toBe(10);
});
```

`project.undo.test.ts`:

```ts
it("refuses a matte naming a track of another composition", …);           // ctx.mutate throws with that message
it("drops a matte with its track and brings both back on undo", …);       // remove track → clip.matte undefined; undo → track and matte back; redo → gone
it("refuses a mask path with two points", …);
```

- [ ] **Step 2: Run** `pnpm vitest run src/modules/project/logic/mask.test.ts src/modules/project/project.undo.test.ts` — Expected: FAIL (`maskPlacement` not defined).
- [ ] **Step 3: Implement** the types, `logic/mask.ts`, `maskProblem` + settle in `logic/fields.ts`, `project_get_state` lines, exports in `index.ts` with TSDoc.
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `pnpm typecheck`.
- [ ] **Step 5: README** (`project`: a **Masks** paragraph: data, space, `maskPlacement`, validation, settle) and commit `feat(project): masks and track mattes in the document`.

---

### Task 2: Project files (`workspace`)

**Files:** Modify `workspace/logic/format.ts`, `workspace/logic/format.test.ts`, `workspace/README.md`.

**Interfaces — Consumes:** Task 1 types. **Produces:** file version 6.

- `VERSION = 6`; the version 5 constant becomes `PATHS_VERSION = 5`. `usesMasks(document)`: any clip with `masks` or `matte`. `encodeProject` writes 6 when `usesMasks`, else the existing chain.
- The file schema accepts `masks`, `maskOrder`, `matte` on clips (Zod, the shapes of Task 1, `.strict()` like the paths schema). A file with a `matte` naming a missing track opens with that matte dropped (same pattern as a dangling `follow`).

- [ ] **Step 1: Write the failing tests** in `format.test.ts`: `"writes version 6 only when a clip has masks or a matte"` (a document without → `version` ≤ 5; with one mask → 6); `"reads masks back unchanged"` (round trip deep-equals); `"drops a matte whose track is missing"`.
- [ ] **Step 2: Run** `pnpm vitest run src/modules/workspace/logic/format.test.ts` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: README** + commit `feat(workspace): project files with masks (version 6)`.

---

### Task 3: Clips that move keep their masks right

**Files:** Modify `speed/speed.commands.ts` (+ `speed.commands.test.ts`), `timeline/timeline.clipboard.commands.ts` (+ `timeline.clipboard.test.ts`), `composition/logic/clone.ts`, `composition/composition.group.command.ts`, `composition/composition.settings.commands.ts` (+ `composition.commands.test.ts`), READMEs of `speed`, `timeline`, `composition`.

**Interfaces — Consumes:** `ClipMask`, `ClipMatte`, `scaleMasks`, `orderedMasks` (Task 1).

- Freeze frame: the hold gets `masks: structuredClone(baked.masks)`, `maskOrder`, `matte` (baked values, no `masks.*` keys, since the hold has no animation).
- Paste: into the clip's own composition keep `matte`; into another drop it. Masks always come along.
- Clone (duplicate composition): `matte.trackId` → the copied track id.
- Group: in the same `ctx.mutate`, a moved clip's `matte.trackId` → `lanes.get(trackId)` when present, else `matte` deleted and the clip id added to a new `droppedMattes: ClipId[]` in the command's result; the command's UI caller and its MCP description say so (a `notify("info", …)` in the composition UI that runs it when the list isn't empty).
- Settings resize with scale: `Object.assign(clip, scaleMasks(clip, Math.min(kx, ky)))` beside `scaleTransform`, with the same `shortcut:` comment.

- [ ] **Step 1: Write the failing tests:**
  - speed: `"a frozen hold keeps its masks at the frozen moment"` (mask `feather` keyed 0 → 100 over the clip; freeze at the middle → hold's mask feather 50, no `masks.` tracks).
  - clipboard: `"a pasted clip keeps its matte in its own composition and drops it in another"`.
  - composition: `"a duplicated composition's matte names the copied track"`; `"grouping a clip with its matte track keeps the matte on the copy"`; `"grouping a clip without its matte track drops the matte and lists it"`; `"resizing with scale scales masks"` (1920×1080 → 960×540, a mask width 400 → 200).
  - timeline: `"splitting a masked clip keeps masks and matte on both halves"` (expected to pass already; keep it only if it fails first, else delete it — rule 3).
- [ ] **Step 2: Run** `pnpm vitest run src/modules/speed src/modules/timeline/timeline.clipboard.test.ts src/modules/composition` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: READMEs** + commit `feat(mask): masks and mattes survive freeze, paste, duplicate, group and resize`.

---

### Task 4: Shared Bézier editing (move, no copy)

**Files:** Move `path/logic/edit.ts` → `project/logic/bezier.ts`, `path/logic/fit.ts` → `project/logic/fit.ts` (`git mv`). Modify `project/index.ts`, every importer in `path` (`ui/*.ts`, `ui/*.tsx`), `path/index.ts`, `path/path.types.ts`, READMEs of `project` and `path`.

**Interfaces — Produces** (from `@/modules/project`): `segmentAt`, `segmentCount`, `movePart`, `insertPoint`, `removePoint`, `nearestOnPath`, `pathData`, `fitStroke`, and `PointPart` (moved to `project.types.ts`). From `@/modules/path`: `startPathEdit`, `startFreehand`, `startPenPoint`, `paintPath`, `framePoint`, and types `PathEditOptions`, `FreehandOptions`, `PenOptions`, `PointPart` re-export. All take frame px (output px from the frame's center), as today.

- [ ] **Step 1:** Move the files, fix imports (`import type { PointPart }` now from `@/modules/project`), add TSDoc to the new exports.
- [ ] **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test` — Expected: all pass, no behavior change.
- [ ] **Step 3: READMEs** + commit `refactor(path): Bézier editing in project, drawing gestures exported`.

---

### Task 5: The `mask` module and its commands

**Files:** Create `mask/index.ts`, `mask.ref.ts`, `mask.module.ts`, `mask.types.ts`, `mask.schema.ts`, `mask.guards.ts`, `mask.commands.ts`, `mask.matte.commands.ts`, `mask.mcp.ts`, `mask.store.ts`, `mask.commands.test.ts`, `README.md`. Modify `src/app/bootstrap.ts`.

**Interfaces — Consumes:** Task 1. **Produces:**

```ts
// mask.types.ts
export type MaskPreset = "rectangle" | "ellipse" | "star" | "heart" | "linear" | "mirror";
export interface MaskUiState { selectedMaskId: MaskId | null; selectedPointId: PointId | null; drawing: null | { mode: "freehand" | "pen" } }
export interface MaskPointInput { x: number; y: number; inX?: number; inY?: number; outX?: number; outY?: number }
export interface MaskApi { readonly ui: StoreApi<MaskUiState> }
declare module "@/core" { interface CommandInputs { "mask.add": …; "mask.update": …; "mask.remove": …; "mask.reorder": …; "mask.setMatte": … } }
// commands
export const addMask;     // { clipIds: ClipId[]; preset?: MaskPreset; points?: MaskPointInput[]; values?: Partial<mask numbers>; mode?; name? } → { maskIds: Record<ClipId, MaskId> }
export const updateMask;  // { clipId; maskId; patch: Partial<Omit<ClipMask,"id"|"shape">> & { shape?: partial numbers of its kind }; at?: Micros } → { clipId; maskId }
export const removeMasks; // { clipId; maskIds: MaskId[] }  (maskIds empty → all of the clip's masks)
export const reorderMask; // { clipId; maskId; index: number }
export const setMatte;    // { clipIds; trackId: TrackId | null; by?: "alpha" | "luma"; invert?: boolean }
```

- `addMask`: exactly one of `preset` / `points` (else `mask.invalid`); `points` (≥ 3, `{x, y, inX?, inY?, outX?, outY?}` in mask space) make a `path` shape with `scale` 1, `x`/`y` = the points' bounding-box center (points stored relative to it), fresh `createId("point")` ids. Defaults per spec, sizes default to half the clip's composition format; `name` `Mask N` (N = first free per clip); `color` cycles `MARKER_COLORS` by the clip's mask count. Every clip must be a picture clip on a video track (`mask.clip_not_found`, `mask.not_picture`: `elements.get(kind)?.definition.picture` missing or audio track).
- `updateMask`: keyed fields need `at` (`mask.animated`, naming the path and `keyframe_set`), like `element.setProps` with `splitAnimated`'s semantics: keyed leaves go through `writeKey` at `contentTime(clip, clampToClip(clip, at))`, the rest static. Range errors `mask.invalid`. `rotation` normalized.
- `setMatte`: `trackId` must exist (`mask.track_not_found`), be video (`mask.not_video`), share the clip's composition (`mask.track_not_found`), not be the clip's own (`mask.own_track`); refuse `mask.matte_chain` when the matte track holds a clip with a `matte` or the clip's own track is a matte of some clip. `null` removes. `by` defaults `alpha`.
- Removing a mask drops its `masks.<id>.` tracks; removing the last drops `masks` and `maskOrder`.
- MCP: `mask_add`, `mask_update`, `mask_remove`, `mask_reorder`, `mask_set_matte` (`commandTool`), and `mask_list` (read: `{ masks: [... ordered, values at `at`(default your playhead) through`animatedClip`, path points as `{ id, x, y, inX, inY, outX, outY }`], matte }`). Descriptions state the mask space ("output px from the picture's center, the picture fitted in the frame before the clip's transform") and each failure code.
- `requires`: `project`, `element`, `keyframe` (key writes), `preview` (the actor's playhead for `mask_list`), and — added in later tasks — `inspector`, `timeline`, `path`, `transform`. List only what the task's code uses at each commit.

- [ ] **Step 1: Write the failing tests** (`mask.commands.test.ts`, fixtures as `path.commands.test.ts`: a test picture element on `v1`, a second video track `v2`, an audio track `a1`):
  - `"adds an ellipse to two clips in one undo step"` (both get one mask; one `history.undo` → none)
  - `"refuses a mask on an audio clip"` → `mask.not_picture`, nothing written
  - `"updating a keyed feather without at fails and with at writes a key"`
  - `"removing the last mask leaves no masks and no mask keys"`
  - `"reorders masks"`
  - `"sets a matte, refuses its own track and a chain"` (`mask.own_track`; v2 clip with matte v1 then v1 clip with matte v2 → `mask.matte_chain`)
- [ ] **Step 2: Run** `pnpm vitest run src/modules/mask` — FAIL.
- [ ] **Step 3: Implement** module, schema, guards, commands, MCP tools; add `maskModule` to `bootstrap.ts`.
- [ ] **Step 4: Run** — PASS; `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: README** (template; command table) + commit `feat(mask): mask and matte commands and tools`.

---

### Task 6: Keys, points and conversion

**Files:** Create `mask/mask.keys.ts`, `mask/logic/keys.ts`, `mask/mask.points.commands.ts`. Modify `mask.module.ts` (contribute `keyTargets`), `mask.mcp.ts`, `mask.commands.test.ts`, `README.md`.

**Interfaces — Consumes:** `insertPoint`, `removePoint`, `segmentAt` (Task 4), `maskOutline` (Task 1), `keyTargets`/`KeyField` (`keyframe`). **Produces:**

```ts
export const maskKeys: KeyTarget; // id "mask.keys"
export const setPoints; // { clipId; maskId; points: Array<MaskPointInput & { id?: PointId }>; insertAt?: { after: PointId; t: number }; at?: Micros } → { pointIds: PointId[] }
export const convertMask; // { clipId; maskId } → { pointIds: PointId[] }
export function pathKeyTimes(clip: Clip, maskId: MaskId): Micros[]; // content times of every key under masks.<id>.shape.points. and .shape.scale
```

- Key paths and fields exactly as spec §2; group `{ prefix: "masks.<id>.", label: mask.name }`; point labels `"Point <n> · X"` (n = 1-based order). `commitStatic` runs `updateMask` / `setPoints` for that one value.
- `setPoints`: ids kept for listed points, new ones get ids, unlisted ones (and their tracks) go. When the mask's points have keys:
  - with `at`: for every point whose coordinates changed, write its six coordinates as keys at `at`.
  - a **new point** inserted between two existing ones: at every time in `pathKeyTimes`, write its keys from `insertPoint(shapeAt(t), i, tAlong)` (the shape sampled at that time through `animatedClip`), and re-key the two neighbors' adjacent handles there; `tAlong` is found from the static insert (`nearestOnPath`) and is sent by the caller as `insertAt` (the one point without an `id` is the inserted one).
  - without `at` on a keyed field → `mask.animated`.
- `convertMask`: preset → path from `maskOutline` (points relative to the mask center, `scale` 1, rotation kept on the mask); if `masks.<id>.shape.*` had keys, the points get keys at the union of their times (the outline at each), and those shape keys go. Linear and mirror can't convert (`mask.invalid`).
- MCP: `mask_set_points` (`setPoints`, with `insertAt`), `mask_convert`.

- [ ] **Step 1: Write the failing tests:**
  - `"inserting a point on an animated path keeps every keyed shape"`: path with 3 points keyed at 0 s and 1 s (different shapes); `setPoints` with a 4th point `insertAt { after: p1, t: 0.5 }`; for t in {0, 1 s} the outline sampled at 32 points along each old segment matches the new one within 1e-6.
  - `"removing a point drops its keys"`.
  - `"converting an animated ellipse keeps its shape at each key"`.
  - `"keying the last key away makes the value static"` (`keyframe.remove` on `masks.<id>.feather` → static feather is that value).
- [ ] **Step 2: Run** `pnpm vitest run src/modules/mask` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: README** + commit `feat(mask): keyable masks, per-point keys and conversion to points`.

---

### Task 7: Drawing masks and mattes (`preview` engine)

**Files:** Create `preview/gpu/gpu.mask.ts`, `preview/engine/engine.masks.ts`. Modify `preview/engine/engine.html.ts`, `engine.types.ts`, `preview/README.md`.

**Interfaces — Consumes:** `orderedMasks`, `maskOutline`, `maskLine`, `maskPlacement`, `ClipMatte` (Task 1); `GpuRunner`, `GpuPass`, `GpuUnavailable`. **Produces (internal to preview):**

```ts
export function blurPasses(sigmaX: number, sigmaY: number): GpuPass[]; // separable Gaussian on alpha, key "mask.blur"
export function lumaAlphaPass(invert: boolean): GpuPass; // alpha = (0.2126r+0.7152g+0.0722b)·a, key "mask.luma"
export class MaskPainter {
  constructor(options: { gpu?: GpuRunner; strict: boolean; onFailure(error: unknown): void });
  /** Draws `masks` (live overrides merged) into an alpha canvas sized like `like`, or null when none is on. */
  masks(
    like: HTMLCanvasElement,
    masks: readonly ClipMask[],
    mapping: MaskMapping,
    kx: number,
    ky: number,
  ): HTMLCanvasElement | null;
  /** The alpha a matte cuts with, from a drawn track canvas. */
  matte(track: HTMLCanvasElement, matte: ClipMatte): HTMLCanvasElement;
  dispose(): void;
}
```

Engine changes:

- `paint` (in `drawFrame`) returns the clip's `MaskMapping` (from the same `format`, `size`, `transform` its draw path already uses: video's decoded size, cache size, `picture.size`, inner format; any of these gives the same mapping) or null when nothing was drawn.
- `drawClip`: when `orderedMasks(placedClip)` has an enabled mask, or the clip has a usable matte (not its own track, its track not a matte), go through the layer path even at Normal 100%: paint → `masks()` → `destination-in`; matte canvas → `destination-in` (alpha or luma) or `destination-out` (inverted alpha); → `landLayer`. Live mask drags: `propsOverrides.get(clip.id)?.masks` (a `Record<MaskId, Partial<ClipMask>>`) merged over the placed clip's masks by id.
- Before the track loop of each `drawFrame`: `matteIds` = video tracks named by a `matte` of any clip of this frame's composition (excluding own-track and chained ones); each is drawn with `drawTrack` + `drawClip` (clips' own mattes ignored) into its own canvas owned by `MaskPainter` (keyed by `prefix + trackId`, never a `MixCanvases` slot), then those tracks are skipped by the loop like hidden ones.
- `prepare()`: a video track in `matteIds` counts as shown for every readiness check even when `hidden` (the three `!track.hidden` places, and `pictures`).
- `only` captures: no masks, no matte. `bypassFilters`: masks and mattes still apply.
- Feather radius in canvas px: `sigma = feather / 2 × |s| × k` per axis (`sx·kx`, `sy·ky`); when sigma > 16, blur a copy shrunk by `ceil(sigma / 16)` and draw it back scaled up. Expansion: stroke the outline at `2|e|·min(|sx|,|sy|)` canvas px wide, round joins, `source-over` (grow) or `destination-out` (shrink). Combining per spec §3 (start opaque when the first enabled mode is subtract/intersect; difference = `xor`).
- GPU failure: `strict` (capture/export, `target !== "preview"`) throws; live preview draws without feather / treats luma as alpha and calls `onFailure` once per kernel, which `notify("warning", "Soft mask edges need the graphics card; masks show hard edges for now.")`.

- [ ] **Step 1: Implement** `gpu.mask.ts`, `engine.masks.ts`, the engine changes.
- [ ] **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test` — all pass (no new tests: canvas code, rule 3).
- [ ] **Step 3: Check live** (`pnpm tauri dev`, MCP): on a video clip `mask_add` ellipse feather 0 → `preview_capture_frame` shows a hard oval; feather 80 → soft; a second mask `subtract` smaller → ring; a text clip on V2 + `mask_set_matte` of the video to V2 by alpha → video only inside the letters, the text itself not drawn; by luma on a white text → same; hide V2 with the eye → unchanged.
- [ ] **Step 4: README** (`preview`: a **Masks and mattes** paragraph) + commit `feat(preview): draw masks and track mattes`.

---

### Task 8: `transform` cooperates

**Files:** Modify `transform/transform.types.ts`, `transform.module.ts`, `logic/layers.ts`, `ui/TransformOverlay.tsx`, `ui/layers.hook.ts`, `index.ts`, `README.md`.

**Interfaces — Produces:**

```ts
// TransformApi
hideBox(owner: string, hidden: boolean): void;            // the box hides while any owner hides it
readonly boxHidden: StoreApi<{ owners: readonly string[] }>;
// VisibleLayer gains: matte?: true   (clip on a track used as a matte)
export { useVisibleLayers } from "./ui/layers.hook";       // from transform's index, with TSDoc
```

- `visibleLayers` keeps matte-track clips but marks `matte: true`; the canvas pick skips them; the box still shows for a selected one.
- `TransformOverlay` renders nothing while `boxHidden.owners` is non-empty.

- [ ] **Step 1: Implement.** **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test` — pass. **Step 3: README** + commit `feat(transform): other tools can hide the box; matte clips aren't picked`.

---

### Task 9: The Mask tab

**Files:** Create `mask/ui/MaskSection.tsx`, `MaskPresets.tsx`, `MaskRow.tsx`, `MaskFields.tsx`, `MatteSection.tsx`, `ui/index.ts`. Modify `mask.module.ts` (contribute `inspectorTabs` `{ id: "mask", label: "Mask", icon: SquareDashed, order: <after Video> }` and two `inspectorSections` in tab `"mask"`: `mask.section` order 0 and `mask.matte` order 100, `appliesTo` picture clips on video tracks), `README.md`.

**Interfaces — Consumes:** commands of Tasks 5–6; `useVisibleLayers` (Task 8, for the default size: half the selected layer's fitted size from `clipPlacement(format, source, IDENTITY_TRANSFORM)`); `KeyAction` (`keyframe`, for diamonds), `FieldRow` (`inspector`), kit (`SegmentedControl`, `IconButton`, `FoldSection`).

- Layout as the spec's sketch. Presets add to every selected picture clip (one `mask.add`); None runs `mask.remove` with empty `maskIds` on each. Pen/Freehand set `ui.drawing`.
- Rows (one clip selected): color dot, name (double-click renames via `mask.update`; Enter/blur commit, Escape cancel), mode select, invert toggle, on toggle, menu: Convert to points (presets only but linear/mirror), Move up/down, Delete. A click sets `ui.selectedMaskId`.
- Fields of the selected mask by kind, each with `KeyAction` on its path(s); Position keys `x` and `y`; Path row's diamond keys every point coordinate (`keyframe.setMany`). Slider drags use `previewProps(clipId, { masks: { [id]: patch } })` live, release sends one `mask.update` with `at` = playhead (rule 24: values set in the DOM while dragging, as other sections do).
- Matte: track select (None + the composition's other video tracks by name), Alpha/Brightness, Invert; with several clips selected it applies to all; failures are toasts.

- [ ] **Step 1: Implement.** **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test`. **Step 3: Check live**: add each preset, rename, reorder, mode change, key feather at two times and scrub. **Step 4: README** + commit `feat(mask): the Mask tab`.

---

### Task 10: Masks on the canvas

**Files:** Create `mask/ui/MaskOverlay.tsx`, `mask.paint.ts`, `mask.box.gesture.ts`, `MaskDrawing.tsx`. Modify `mask.module.ts` (contribute two `previewOverlays`; require `path`, `transform`), `README.md`.

**Interfaces — Consumes:** `maskPlacement`, `maskOutline`, `maskLine`, `pathData` (Task 1/4); `startPathEdit`, `startFreehand`, `startPenPoint`, `paintPath` (Task 4); `useVisibleLayers`, `hideBox` (Task 8); `previewProps`, viewport (`preview`). **Produces:** `toFrame(mapping, p)`, `toMask(mapping, p)` in `mask.paint.ts` (the mapping both ways; the gestures work in frame px and every result is mapped back before a command).

- Shown when exactly one picture clip is selected and the Mask tab is open or a mask is selected; outlines of every enabled mask in its color (SVG in the frame's space, `vector-effect: non-scaling-stroke`, dashed when off). While `ui.selectedMaskId` is set: `hideBox("mask", true)`; Escape or a press on empty space clears it.
- Preset handles per spec §4 (`mask.box.gesture.ts`: move, corners, sides, rotate with Shift 15°, feather double-arrow, roundness dot, star inner dot, mirror width, linear rotate). Each drag repaints in the DOM and through `previewProps`; release sends one `mask.update` with `at`; Escape cancels.
- Path masks: `startPathEdit` on the mapped points; insert on double-click sends `mask.setPoints` with `insertAt`; Delete removes the selected point while ≥ 4 remain; a drag inside moves `x`/`y`.
- `MaskDrawing` (while `ui.drawing`): pen and freehand through the path gestures; finishing sends one `mask.add` with `points` mapped to mask space (freehand closes on release; pen closes on the first point or Enter/Done, ≥ 3 points else nothing), then selects it.

- [ ] **Step 1: Implement.** **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test`. **Step 3: Check live** on a scaled, rotated, flipped clip that follows a motion path: every handle drags the drawn mask exactly under the pointer; draw a pen and a freehand mask; key the Path at two times, drag one point at a third time and scrub. **Step 4: README** + commit `feat(mask): edit and draw masks on the canvas`.

---

### Task 11: Matte badge, docs, final check

**Files:** Create `mask/ui/MatteBadge.tsx`. Modify `mask.module.ts` (contribute `timelineTrackControls` `mask.matteBadge`; require `timeline`), `mask/README.md`, `CHANGELOG.md`, `CHANGELOG.es.md`, `docs/architecture.md` only if it lists modules.

- The badge shows on a video track named by any clip's `matte`: an icon with the tooltip `"Matte for: <clip names>"`; nothing otherwise.

- [ ] **Step 1: Implement** the badge and changelog entries (English and Spanish, under Unreleased).
- [ ] **Step 2: Run** `pnpm typecheck && pnpm lint && pnpm test` — all pass.
- [ ] **Step 3: Live check** (spec's "Done means"): feathered ellipse; subtract ring; animated pen mask; text as alpha and luma matte over video; a masked clip inside a nested composition; a transition between two masked clips; export to a file and compare a frame with `preview_capture_frame` at the same time (same placement and softness).
- [ ] **Step 4: Prune** any test added in Tasks 1–6 that doesn't meet rule 3 (memory: prune tests after work).
- [ ] **Step 5: Commit** `feat(mask): matte badge on tracks; docs and changelog`.
