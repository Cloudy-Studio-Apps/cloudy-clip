# Transform pivot, stretch and flip: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the shared `transform` group an After Effects–style pivot, separate Width/Height
stretch (negative = flipped), Flip H/V buttons and canvas handles for all of it.

**Architecture:** Four new fields on `ClipTransform` (`scaleX`, `scaleY`, `pivotX`, `pivotY`).
`clipPlacement()` folds the pivot into the placement's center and reports `flipX`/`flipY`, so the
drawers only add a mirror. The `transform` module owns the props, the `transform.flip` command
and its MCP tool, the menu items and the canvas gestures.

**Tech Stack:** TypeScript (strict), React 19, Zod, Vitest, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-11-19-transform-pivot-stretch-flip-design.md`

## Global Constraints

- Rules in `CLAUDE.md` apply. In particular: no deep imports, every change through a command, one
  undo step per gesture (one command on release), no React state on per-frame paths, types in
  `.types.ts`, TSDoc on exports/commands/tools, kit tokens only.
- Field ranges: `scaleX`/`scaleY` −20…20 (panel slider `ui` −4…4, step 0.01, shown ×100 as %);
  `pivotX`/`pivotY` −10…10 (shown ×100 as %, number fields); identity 1, 1, 0, 0.
- `x`/`y` are the pivot's position (offset from the frame's center, output px). Pivot 0 ⇒ today's
  meaning exactly.
- `ClipPlacement.width`/`height` stay ≥ 0; the sign goes to `flipX`/`flipY`.
- Commits: conventional messages, **no `Co-Authored-By` line and no Claude attribution**.
- Done = `pnpm typecheck`, `pnpm lint`, `pnpm test` pass. No Rust changes.
- Tests only where rule 3 allows: `project.geometry.test.ts` (document integrity). No other new
  tests.

## Review Focus

1. **Old projects and keys** (no new fields stored) must place pixel-identically to today: covered
   by the existing `clipPlacement` tests staying green unchanged, plus `toEqual` updates for the
   two new flags only.
2. **Rotated + off-center pivot**: rotating about the pivot must leave the pivot fixed on screen;
   test in Task 1 (`keeps the pivot fixed when rotating`).
3. **Flipped and rotated picture** under a click or the tint color picker must map to the right
   source pixel: Task 2 mirrors `pictureAt`; checked by hand in Task 6.
4. **Width or Height at exactly 0**: draws nothing, no crash (no division by zero in text scale,
   picking, the pivot gesture); test in Task 1 (`zero width places a zero-size picture`), guards
   in Tasks 2 and 4.
5. **Flip on a clip with keyed `scaleX`**: every key negated in the same undo step, and Undo
   restores them all; checked through MCP in Task 6.

## Known limit (changed from the spec)

The spec's "frame resize keeps the picture where it was with an off-center pivot" needs each
clip's source picture size inside `composition.setSettings`, which it doesn't have. `resize.ts`
keeps scaling `x`/`y` as today: with the pivot at its default nothing changes; with an off-center
pivot and an aspect change, the picture shifts by the pivot's offset times the difference of the
ratios. Leave a `shortcut:` comment in `resize.ts` and a line in the spec. Upgrade when resize gets
picture sizes.

## File tree

```
src/modules/project/
  project.types.ts                 edit: ClipTransform +4 fields, ClipPlacement +flipX/flipY
  project.geometry.ts              edit: IDENTITY_TRANSFORM, clipPlacement pivot/stretch/flip
  project.geometry.test.ts         edit: new cases, flags in existing expectations
  README.md                        edit: transform fields
src/modules/preview/engine/engine.html.ts      edit: land() mirrors
src/modules/sticker/sticker.draw.ts            edit: mirror
src/modules/solid/solid.element.ts             edit: mirror
src/modules/text/text.draw.ts                  edit: X/Y scale + mirror, zero guard
src/modules/text/ui/TextEditor.tsx             edit: X/Y scale
src/modules/text/README.md                     edit: one line
src/modules/tint/logic/pick.ts                 edit: pictureAt mirrors u/v
src/modules/tint/README.md                     edit: one line
src/modules/composition/logic/resize.ts        edit: shortcut comment only
src/modules/transform/
  transform.group.ts               edit: props + layout (Stretch row, Pivot row, Flip choices)
  transform.commands.ts            edit: transform.flip, reset description
  transform.mcp.ts                 edit: transform_flip
  transform.menu.ts                edit: Flip horizontally / vertically
  transform.types.ts               edit: CommandInputs, gesture modes, FlipAxis
  logic/commit.ts                  edit: TRANSFORM_KEYS from IDENTITY_TRANSFORM
  logic/gestures.ts                edit: stretchTransform, pivotTransform
  logic/picking.ts                 edit: zero-size guard
  ui/box.style.ts                  edit: pivotStyle
  ui/SelectionBox.tsx              edit: side handles, pivot crosshair
  ui/TransformOverlay.tsx          edit: new handle modes
  ui/transform.gesture.ts          edit: pivot-centered scale/rotate, stretch, pivot
  README.md                        edit
docs/superpowers/specs/2026-11-19-transform-pivot-stretch-flip-design.md   edit: known limit
CHANGELOG.md, CHANGELOG.es.md      edit: Unreleased → Added
```

---

### Task 1: The model and the placement (`project`)

**Files:**

- Modify: `src/modules/project/project.types.ts` (`ClipTransform`, `ClipPlacement`)
- Modify: `src/modules/project/project.geometry.ts`
- Test: `src/modules/project/project.geometry.test.ts`
- Modify: `src/modules/project/README.md`
- Modify: every file `pnpm typecheck` then flags for a full `ClipTransform` or `ClipPlacement`
  literal (spread `IDENTITY_TRANSFORM`; add `flipX: false, flipY: false`).

**Interfaces:**

- Produces: `ClipTransform { x; y; scale; scaleX; scaleY; rotation; pivotX; pivotY }` (all
  `number`, TSDoc per field as in the spec's table); `ClipPlacement` gains `flipX: boolean`,
  `flipY: boolean`; `IDENTITY_TRANSFORM` = `{ x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1,
rotation: 0, pivotX: 0, pivotY: 0 }`; `clipPlacement(format, source, transform, fit)` unchanged
  signature.

- [ ] **Step 1: Write the failing tests** in `project.geometry.test.ts`

```ts
const square = { width: 1000, height: 1000, fps: 30 };
const src = { width: 1000, height: 1000 };
const t = (patch: Partial<ClipTransform>) => ({ ...IDENTITY_TRANSFORM, ...patch });

it("stretches each axis on its own", () => {
  expect(clipPlacement(square, src, t({ scaleX: 1.5, scaleY: 0.5 }))).toMatchObject({
    width: 1500,
    height: 500,
    flipX: false,
    flipY: false,
  });
});
it("flips with a negative factor and keeps sizes positive", () => {
  expect(clipPlacement(square, src, t({ scaleX: -1, scaleY: -2 }))).toMatchObject({
    width: 1000,
    height: 2000,
    flipX: true,
    flipY: true,
  });
});
it("puts the pivot at x/y: a left-edge pivot shifts the picture right", () => {
  // pivot at the left edge sits at the frame center, so the picture's center is 500 px right
  expect(clipPlacement(square, src, t({ pivotX: -0.5 }))).toMatchObject({ cx: 1000, cy: 500 });
});
it("keeps the pivot fixed when rotating", () => {
  const p = clipPlacement(square, src, t({ pivotX: -0.5, rotation: 90 }));
  // the picture swings about the frame center: its center goes below it
  expect(p.cx).toBeCloseTo(500);
  expect(p.cy).toBeCloseTo(1000);
});
it("mirrors the pivot with the flip", () => {
  expect(clipPlacement(square, src, t({ pivotX: -0.5, scaleX: -1 }))).toMatchObject({ cx: 0 });
});
it("zero width places a zero-size picture", () => {
  expect(clipPlacement(square, src, t({ scaleX: 0, pivotX: 0.3 }))).toMatchObject({
    width: 0,
    cx: 500,
  });
});
```

Also add `flipX: false, flipY: false` to the two existing `toEqual` expectations, and give the
literal `{ x: 100, y: -50, scale: 0.5, rotation: 30 }` the identity spread.

- [ ] **Step 2: Run** `pnpm vitest run src/modules/project/project.geometry.test.ts`
      Expected: the new cases FAIL (type errors or wrong values).

- [ ] **Step 3: Implement** the types, `IDENTITY_TRANSFORM` and `clipPlacement` per the spec's
      "Placement" formula: `w = source.width·f·scale·|scaleX|`, `h` likewise,
      `p = (pivotX·w·sign(scaleX), pivotY·h·sign(scaleY))` (use `Math.sign(...) || 1` so 0 isn't
      a third case), `cx = W/2 + x − (p.x·cosθ − p.y·sinθ)`,
      `cy = H/2 + y − (p.x·sinθ + p.y·cosθ)`, `flipX = scaleX < 0`, `flipY = scaleY < 0`. Update the
      `ClipTransform` doc comment ("scaled, rotated and stretched about its pivot, which sits at
      x/y").

- [ ] **Step 4: Run** the file again; Expected: PASS. Then `pnpm typecheck` and fix every flagged
      literal by spreading `IDENTITY_TRANSFORM` (or adding the flags). Expected: 0 errors.

- [ ] **Step 5:** Update `project/README.md` (the `Clip.transform` line: the new fields, x/y are the
      pivot; `clipPlacement` reports `flipX`/`flipY`). `pnpm test && pnpm lint`; Expected: pass.

- [ ] **Step 6: Commit** `feat(project): pivot, stretch and flip in the clip transform`

### Task 2: Every drawer mirrors and stretches

**Files:**

- Modify: `src/modules/preview/engine/engine.html.ts:84-95` (`land`)
- Modify: `src/modules/sticker/sticker.draw.ts`, `src/modules/solid/solid.element.ts`
- Modify: `src/modules/text/text.draw.ts`, `src/modules/text/ui/TextEditor.tsx`,
  `src/modules/text/README.md`
- Modify: `src/modules/tint/logic/pick.ts` (`pictureAt`), `src/modules/tint/README.md`

**Interfaces:**

- Consumes: `ClipPlacement.flipX/flipY` (Task 1).

- [ ] **Step 1:** In `land`, the sticker and the solid draw: right after `rotate`, add
      `ctx.scale(place.flipX ? -1 : 1, place.flipY ? -1 : 1)`.
- [ ] **Step 2:** `text.draw.ts`: replace the one factor with
      `sx = place.width / natural.width`, `sy = place.height / natural.height` (natural = the
      requested font's box, as today), `ctx.scale(sx·(flipX ? −1 : 1), sy·(flipY ? −1 : 1))`;
      return before drawing when `sx` or `sy` is 0 (after `ctx.restore` balance). Wherever the file
      divides by the old `scale` (shadow/outline compensation), pick `Math.min(sx, sy)` and say so
      in one comment.
- [ ] **Step 3:** `TextEditor.tsx`: CSS
      `scale(${k * transform.scale * transform.scaleX}, ${k * transform.scale * transform.scaleY})`.
- [ ] **Step 4:** `pictureAt`: when `placement.flipX`, `u = 1 − u`; when `flipY`, `v = 1 − v`;
      return `aspect` unchanged. Update its doc comment.
- [ ] **Step 5:** README lines: text ("stretches on both axes and mirrors with the transform"),
      tint (`pictureAt` undoes the flip). `pnpm typecheck && pnpm lint && pnpm test`; pass.
- [ ] **Step 6: Commit** `feat: drawers stretch and mirror pictures by their placement`

### Task 3: Props, panel, flip command, tool and menu (`transform`)

**Files:**

- Modify: `src/modules/transform/transform.group.ts`, `transform.commands.ts`, `transform.mcp.ts`,
  `transform.menu.ts`, `transform.types.ts`, `README.md`
- Modify: `src/modules/composition/logic/resize.ts` (comment only),
  `docs/superpowers/specs/2026-11-19-transform-pivot-stretch-flip-design.md` (Known limit)

**Interfaces:**

- Produces: `export type FlipAxis = "horizontal" | "vertical"` (`transform.types.ts`);
  `CommandInputs["transform.flip"]: { clipIds: string[]; axis: FlipAxis }`;
  `flipTransform` command (exported from `transform.commands.ts`, in `transformCommands`);
  MCP tool `transform_flip`.

- [ ] **Step 1:** `transform.group.ts` properties (order x, y, scale, scaleX, scaleY, rotation,
      pivotX, pivotY):
      `scaleX: prop.number({ min: -20, max: 20, label: "Width", control: "slider", ui: { min: -4, max: 4, step: 0.01 }, display: { scale: 100, unit: "%" } })`,
      `scaleY` the same with `label: "Height"`;
      `pivotX: prop.number({ min: -10, max: 10, label: "X", display: { scale: 100, unit: "%" } })`,
      `pivotY` with `label: "Y"`. Layout items:
      `[{ row: ["x","y"], label: "Position" }, "scale", { row: ["scaleX","scaleY"], label: "Stretch" }, "rotation", { row: ["pivotX","pivotY"], label: "Pivot" }, { command: "transform.flip", control: "choices", label: "Flip" }]`.
      Update the group's doc comment (pivot semantics). If the slider control renders badly inside
      a labeled row, fall back to the number control for `scaleX`/`scaleY` (drop `control`).
- [ ] **Step 2:** `flipTransform = defineCommand({ id: "transform.flip", label: "Flip", undoable: true, input: z.object({ clipIds: z.array(z.string()).min(1), axis: z.enum(["horizontal","vertical"]) }) })`.
      Validate first: unknown id → `transform.clip_not_found`; clip not on a video track →
      `transform.not_picture`. Then one `ctx.mutate`: field = `scaleX` or `scaleY`;
      `clip.transform = { ...clip.transform, [field]: -clipTransform(clip)[field] }`; and if
      `clip.animation?.[`transform.${field}`]` exists, negate every key's `value`. Returns the
      clips. Description for agents: what it does, that it negates keys too, and that
      `element_set_props` with `{ transform: { scaleX: -1 } }` is the same thing for one value.
- [ ] **Step 3:** `resetTransform` description: list all eight fields. `transform.mcp.ts`: add
      `commandTool(flipTransform, { name: "transform_flip" })`.
- [ ] **Step 4:** `transform.menu.ts`: two items in group `"reset"` before Reset transform,
      `FlipHorizontal2` "Flip horizontally" and `FlipVertical2` "Flip vertically", running
      `flipTransform` with the same `clipIds` (lucide-react).
- [ ] **Step 5:** `resize.ts`: above `scaleTransform`, the comment
      `// shortcut: an off-center pivot drifts when the aspect changes (needs the picture size), upgrade when resize gets picture sizes`.
      Add the same limit under "Calls made after the builder check" in the spec, replacing the
      "Frame resize keeps the picture where it was" bullet.
- [ ] **Step 6:** `transform/README.md`: the group's fields and their meaning, the panel layout,
      the menu items, the command table row `transform.flip` | `transform_flip`, drop "flip" from
      "Not yet". `pnpm typecheck && pnpm lint && pnpm test`; pass.
- [ ] **Step 7: Commit** `feat(transform): stretch, pivot fields and the flip command`

### Task 4: Gesture math (`transform/logic`)

**Files:**

- Modify: `src/modules/transform/logic/commit.ts`, `logic/gestures.ts`, `logic/picking.ts`

**Interfaces:**

- Produces:
  - `export const TRANSFORM_KEYS = Object.keys(IDENTITY_TRANSFORM) as (keyof ClipTransform)[]`
    (`commit.ts`; `transformPatch` iterates it).
  - `stretchTransform(start: ClipTransform, pivot: FramePoint, axis: "x" | "y", from: FramePoint, to: FramePoint): ClipTransform`
  - `pivotTransform(start: ClipTransform, placement: ClipPlacement, delta: FramePoint): ClipTransform`
  - `scaleTransform`/`rotateTransform` unchanged; callers pass the pivot point as `center`.

- [ ] **Step 1:** `stretchTransform`: project `from − pivot` and `to − pivot` onto the picture's
      own axis for `axis` (unit vector `(cosθ, sinθ)` for x, `(−sinθ, cosθ)` for y,
      θ = `start.rotation`); if the start projection is 0 return `start`; new factor =
      `start[scaleX|scaleY] × now / before`, clamped to −20…20. Sign changes when crossing the
      pivot (spec "Side handle math").
- [ ] **Step 2:** `pivotTransform`: with `w = placement.width`, `h = placement.height`, return
      `start` when either is 0; `local = R(−θ)·delta`; `pivotX += local.x / (w · (flipX ? −1 : 1))`,
      `pivotY += local.y / (h · (flipY ? −1 : 1))`, clamped to ±10; `x += delta.x`, `y += delta.y`
      (the picture's center stays put; see the spec's formula).
- [ ] **Step 3:** `containsPoint`: `false` when `width` or `height` is 0.
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test`; pass. Commit
      `feat(transform): stretch and pivot gesture math`

### Task 5: Canvas handles (`transform/ui`)

**Files:**

- Modify: `src/modules/transform/transform.types.ts` (`TransformGestureMode`),
  `ui/box.style.ts`, `ui/SelectionBox.tsx`, `ui/TransformOverlay.tsx`, `ui/transform.gesture.ts`,
  `README.md`

**Interfaces:**

- Consumes: Task 4's functions and `TRANSFORM_KEYS`.
- Produces: `TransformGestureMode = "move" | "scale" | "rotate" | "stretchX" | "stretchY" | "pivot"`;
  `pivotStyle(transform: ClipTransform): { left: string; top: string }` in `box.style.ts`
  (`50% + pivotX·sign(scaleX)·100%`, same for top; the box is unmirrored and CSS-rotated about its
  center, so % inside it is right).

- [ ] **Step 1:** `SelectionBox`: new prop `handles: { scale; rotate; stretchX; stretchY; pivot }`
      and `transform: ClipTransform`. Side handles: `data-handle="stretchX"` at the middle of the
      left and right edges (`cursor-ew-resize`), `"stretchY"` at top and bottom
      (`cursor-ns-resize`), same look as the corners. Pivot crosshair: `data-handle="pivot"`, a
      small square-cornered ring (`rounded-xs`, `border-primary`, `bg-transparent`) with a 1px
      cross, centered on `pivotStyle(transform)`, `cursor-crosshair`, `title="Pivot"`.
- [ ] **Step 2:** `TransformOverlay`: accept the new handle modes from `data-handle`; pass
      `handles` from `selected.fields` (`scaleX`, `scaleY`, `pivotX && pivotY`) and
      `transform={selected.transform}`.
- [ ] **Step 3:** `transform.gesture.ts`: `KEYS` → `TRANSFORM_KEYS`. The pivot point is
      `{ x: format.width / 2 + start.x, y: format.height / 2 + start.y }`; `scale` and `rotate`
      use it as `center`. `stretchX`/`stretchY` call `stretchTransform(start, pivot, "x"|"y",
from, to)`. `pivot` calls `pivotTransform(start, startPlacement, to − from)`. Each move also
      writes `pivotStyle(current)` to the box's `[data-handle="pivot"]` element. Cursors:
      `ew-resize`, `ns-resize`, `crosshair`.
- [ ] **Step 4:** README: the canvas section (side handles stretch, dragging past the pivot flips,
      the crosshair moves the pivot without moving the picture, scale and rotate turn about the
      pivot). `pnpm typecheck && pnpm lint && pnpm test`; pass.
- [ ] **Step 5: Commit** `feat(transform): side handles and a pivot on the canvas`

### Task 6: Check it in the app, changelog

**Files:**

- Modify: `CHANGELOG.md`, `CHANGELOG.es.md` (new `## [Unreleased]` → `### Added` above 0.1.0)

- [ ] **Step 1:** `pnpm tauri dev`. With a video, a text and a sticker clip, check by hand: pivot
      at the left edge then rotate swings about it; corner scale grows from the pivot; a side
      handle stretches, past the pivot flips; dragging the crosshair doesn't move the picture;
      Flip buttons and menu items mirror and are one undo; the tint color picker on a flipped
      clip reads the pixel under the pointer; export of a flipped clip matches the preview.
- [ ] **Step 2:** Through MCP: `element_set_props` with `{ transform: { scaleX: 0 } }` draws
      nothing and doesn't throw; key `transform.scaleX` at two times, `transform_flip`, then
      `keyframe_list_fields`/`project_get_state` show both keys negated, `history_undo` restores
      them.
- [ ] **Step 3:** Changelog lines (English and Spanish): pivot, Width/Height stretch, flip
      (buttons, menu, `transform_flip`), side handles and the pivot crosshair. Prettier check.
- [ ] **Step 4: Commit** `docs: changelog for pivot, stretch and flip`
