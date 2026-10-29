# Elements Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding of the whole-branch review of the elements work (4 important, 13 minor, plus the rulable "declined to judge" lines), so the generated inspector behaves as a user expects.

**Architecture:** No new concepts. Live shared-group values flow through the existing `propsOverride`; the canvas tools ask the clip's element which transform fields it supports; the layout resolver learns about a color's opacity sibling and rows; controls honor `disabled`; the generic commands stop writing when nothing changes and validate before writing.

**Tech Stack:** TypeScript strict, React 19, Zustand 5, Immer 11, Zod 4, Vitest (node).

**Spec:** `docs/superpowers/specs/2026-10-29-elements-design.md`. Findings are numbered as in the review (R1–R17, D1–D5 for the declined-to-judge lines).

## Global Constraints

- All rules in `CLAUDE.md`. Each task updates the README of every folder it changes.
- Done means `pnpm typecheck && pnpm lint && pnpm test` pass at the end of every task.
- Commits: no `Co-Authored-By` lines.
- No behavior change outside the findings. The data model (`clip.props`, `clip.transform`) is unchanged.

## Rulings on the declined-to-judge lines

- D1 `{ group, items }` leaves the group's unlisted fields to "Other" with a warning: **keep** (consistent with "forgotten properties go to Other").
- D2 `text` requires `transform`: **keep**. Text `supports` the transform group, which only the transform module registers.
- D3 the inspector's Words box and the canvas editor both writing `previewProps`: **keep**. Both can't be focused at once.
- D4 a new drag starting while the previous commit runs loses its pending input: **fix** in Task 7 (small).
- D5 the Vite chunk warning: **verify** in Task 8 whether it predates this work; fix nothing.
- R17 the Text tab's "Add text" button and "Text" tile do the same: **drop the button**. The tile does click and drag.

## Review Focus

1. A panel slider drag of `transform.scale` on a **media** clip previews live, and the selection box follows. Test in Task 1.
2. An element with `except: ["rotation"]` can be moved on the canvas (no failure) and shows no rotate handle. Test in Task 2.
3. An element with a picture but no transform support is neither hit-tested nor draggable. Test in Task 2.
4. A patch that changes nothing (`{}`, or a value equal to the stored one) adds no undo step. Test in Task 5.
5. A read-only field's control is disabled, so no failing command is sent. Covered by Task 4's `disabled` wiring (UI, no DOM test), with the `isEnabled` logic test already present.

---

### Task 1: Panel transform values preview live (R1)

**Files:**

- Modify: `src/modules/project/project.geometry.ts` (`clipTransform`), `project.geometry.test.ts`, `README.md`
- Modify: `src/modules/preview/engine/engine.html.ts` (draw loop), `README.md`
- Modify: `src/modules/transform/logic/layers.ts`, `transform.types.ts` (`VisibleLayer.transform`), `ui/TransformOverlay.tsx`, `logic/logic.test.ts`, `README.md`

**Interfaces:**

- Produces: `clipTransform(clip: Clip, live?: Partial<ClipTransform>): ClipTransform`, which is the saved transform (or identity) with `live` merged over it.
- Produces: `VisibleLayer.transform: ClipTransform`, the transform drawn now (the live `transform` patch from `liveProps` merged over the saved one).
- Engine: `transform = transforms.get(id) ?? clipTransform(clip, propsOverrides.get(id)?.transform)` for **every** picture, media included. The gesture map still wins.
- Overlay: `placed` uses `layer.transform`, not `clipTransform(clip)`.

- [ ] **Step 1: Write the failing tests.**
  - `project.geometry.test.ts`: `clipTransform({ ...clip, transform: { x: 5, y: 0, scale: 2, rotation: 0 } }, { scale: 3 })` → `{ x: 5, y: 0, scale: 3, rotation: 0 }`; without a saved transform and with `{ x: 4 }` → `{ x: 4, y: 0, scale: 1, rotation: 0 }`.
  - `logic.test.ts`: `visibleLayers(state, elements, size, 7, measure, () => ({ transform: { scale: 2 } }))` gives the media layer `transform.scale === 2`.
- [ ] **Step 2: Run** `pnpm vitest run src/modules/project src/modules/transform/logic`. Expected: FAIL.
- [ ] **Step 3: Implement** as in Interfaces. A non-object `transform` in the override is ignored.
- [ ] **Step 4: Verify** with `pnpm typecheck && pnpm lint && pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit** `fix(transform): panel transform values preview live in the engine and the box`

### Task 2: Canvas tools respect the element's transform fields (R2)

**Files:**

- Modify: `src/modules/transform/logic/layers.ts` (skip clips whose element has no `transform` group; add `VisibleLayer.fields`), `transform.types.ts`, `logic/logic.test.ts`
- Create: `src/modules/transform/logic/commit.ts` (`transformPatch`), `logic/commit.test.ts`
- Modify: `ui/transform.gesture.ts`, `ui/TransformOverlay.tsx`, `ui/SelectionBox.tsx`, `README.md`

**Interfaces:**

- Produces: `VisibleLayer.fields: ReadonlySet<"x" | "y" | "scale" | "rotation">`, the transform group's fields on the clip's resolved element. A clip whose element has no `transform` group is **not** in the list.
- Produces: `transformPatch(start: ClipTransform, current: ClipTransform, fields: ReadonlySet<string>): Partial<ClipTransform> | null`. It returns only the fields that changed and that are in `fields`, or null when none did.
- Gesture: commits `{ transform: transformPatch(...) }`, or nothing when null.
- SelectionBox: props `handles: { scale: boolean; rotate: boolean }`. The corners render only when `scale` is supported, the rotate handle only when `rotation` is.
- Overlay: `move` starts only when `x` or `y` is supported. Without them, a click selects and nothing drags.

- [ ] **Step 1: Write the failing tests.**
  - `commit.test.ts`:
    - `transformPatch(a, { ...a, x: 9, rotation: 30 }, new Set(["x", "y", "scale"]))` → `{ x: 9 }`.
    - Unchanged → `null`.
    - Only an excepted field changed → `null`.
  - `logic.test.ts`:
    - A third fake element `"shape"` with a picture and no `groups` is left out.
    - A fake text element whose `groups` has a transform group without `rotation` yields `fields` without `"rotation"`.
  - Extend the fake registry so `get(kind)` returns `{ definition, groups }`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `fields` comes from `elements.get(kind).groups.find((g) => g.id === "transform")?.properties` (its keys).
- [ ] **Step 4: Verify.** All checks pass.
- [ ] **Step 5: Commit** `fix(transform): canvas tools follow the element's supported transform fields`

### Task 3: Layout resolver fixes (R3, R11, R12)

**Files:**

- Modify: `src/modules/element/logic/layout.ts`, `element.types.ts` (move `ControlOf` here as `LayoutControlOf`), `logic/layout.test.ts`, `src/modules/text/text.panel.test.ts`, `README.md`

**Rules:**

- R3: a color field whose spec names `opacity` places its sibling path (`<parent>.<opacity>`) with it. `expand` doesn't list the sibling. A sibling that isn't otherwise placed is not "forgotten". Listing it explicitly as well counts as "placed twice" (issue).
- R12: items inside `{ row }` are resolved with `inRow = true`, so a path placed in a row and again outside raises no issue (as documented).
- R11: `type LayoutControlOf = (path: string, spec: PropSpec) => string` lives in `element.types.ts`.

- [ ] **Step 1: Write the failing tests.**
  - `layout.test.ts`: a group `{ color: prop.color({ opacity: "opacity" }), opacity: prop.number() }` expands to one field item (`color`) and no issue.
  - `layout.test.ts`: `[{ title: "A", items: [{ row: ["size"] }, "size", "text", "letterSpacing", "box"] }]` → no issue.
  - `text.panel.test.ts`: the Fill section has exactly one item (`fill.color`). Background and Shadow have no `*.opacity` item.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.** All checks pass.
- [ ] **Step 5: Commit** `fix(element): a color's opacity is placed with it; rows may repeat a path`

### Task 4: Controls honor `disabled` (R4)

**Files:**

- Modify: `src/ui/kit/SliderField.tsx`, `NumberField.tsx`, `SelectField.tsx`, `SegmentedControl.tsx`, `ColorField.tsx` (each gets an optional `disabled?: boolean` that disables its inputs, with `disabled:opacity-50` styling), `src/ui/README.md`
- Modify: `src/modules/inspector/ui/controls/SliderControl.tsx`, `NumberControl.tsx`, `SelectControl.tsx`, `ChoiceControl.tsx`, `ColorControl.tsx`; `src/modules/text/ui/controls/FontWeightControl.tsx`, `FontPickerControl.tsx` (disables the trigger)
- Modify: `src/modules/inspector/inspector.types.ts` (`SectionLayoutProps.enabled(path: string): boolean`), `ui/ElementPanel.tsx` (supplies it from `isEnabled(spec, values)`), `ui/PanelSection.tsx` and `ui/SubSection.tsx` (header switch `disabled={!enabled(header)}`), `README.md`

- [ ] **Step 1: No logic is added** (UI wiring only; `isEnabled` is already tested). State this in the commit body.
- [ ] **Step 2: Implement.** Pass `disabled` to every kit field. The `FontPicker` gains `disabled?: boolean` for its trigger button.
- [ ] **Step 3: Verify.** All checks pass. Grep that every `FieldControlProps` consumer reads `disabled`: `grep -L "disabled" src/modules/inspector/ui/controls/*Control.tsx src/modules/text/ui/controls/*Control.tsx` lists only `ButtonControl`, `ChoicesControl`, `PresetRowControl` (the command controls).
- [ ] **Step 4: Commit** `fix(inspector): read-only and disabled fields can't be edited`

### Task 5: Generic commands write only real changes and validate first (R6, R7, R8, R9)

**Files:**

- Modify: `src/modules/element/element.commands.ts`, `logic/apply.ts`, `element.commands.test.ts`, `README.md`
- Modify: `src/modules/transform/transform.commands.ts`, `transform.commands.test.ts`
- Modify: `src/modules/timeline/timeline.element.command.ts`, `timeline.element.command.test.ts`, `README.md`

**Rules:**

- R8: `setProps` and `resetProps` skip a clip whose new props and group values deep-equal the stored ones. When no clip changes they don't call `ctx.mutate`, so no undo step is pushed. `transform.reset` skips clips without a transform the same way.
- R7: `applyPropsPatch` runs the element's `normalize` only when the patch has at least one own (non-group) key.
- R6: `resetProps` checks each path against `element.fields` and the group keys. An unknown path fails `element.invalid_props` (`"<path>" is not a property of <name>`); a read-only one fails `element.read_only`. After resetting, the props go through `normalize` (with `patch: {}`) and `minimizeProps`.
- R9: `timeline.addElement` parses `props` with `element.schema` and checks the groups against the target track kind **before** creating a track or the clip (`element.invalid_props`). The nested `setProps` stays as the writer.

- [ ] **Step 1: Write the failing tests.**
  - `element.commands.test.ts`:
    - An empty patch, and a patch equal to the stored values, leave `kernel.history` with no new entry (compare `kernel.history.getSnapshot().past.length`).
    - Undo after `{ size: 20, box: { pad: 9 } }` then `{ size: 30 }` restores exactly `{ size: 20, box: { pad: 9 } }` (R16 part 1).
    - `resetProps` with `paths: ["nope"]` → `element.invalid_props`; with `["locked"]` → `element.read_only`.
    - With a `normalize` spy element: a transform-only patch doesn't call `normalize`.
  - `transform.commands.test.ts`: `transform.reset` on an untransformed clip adds no undo step.
  - `timeline.element.command.test.ts`: `{ kind: "note", props: { size: 500 } }` fails `element.invalid_props` and the project is unchanged (this already passes because of rollback; it pins the behavior). That validation runs **before** any write isn't observable in state, so check it by reading the command: the `element.schema` parse comes before `addTrack` and `ctx.mutate`.
- [ ] **Step 2: Run.** Expected: FAIL (the history-length and normalize-spy tests).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.** All checks pass.
- [ ] **Step 5: Commit** `fix(element): no-op edits add no undo step; reset validates its paths; add validates first`

### Task 6: Registry and prop types (R5, R10, R13 tool part, R14)

**Files:**

- Modify: `src/modules/element/logic/schema.ts` (an unregistered custom type → `z.never()` with message `value type "<name>" is not registered`), `logic/schema.test.ts`
- Modify: `src/modules/element/element.registry.ts` (`build` warns once per missing prop type: `element "<kind>": value type "<name>" for "<path>" is not registered (is its module loaded?)`)
- Modify: `src/modules/element/element.types.ts`: `DrawEnv.ensureFont(request: FaceRequest)`, where `FaceRequest = { family: string; source: string; weight: string; style: "normal" | "italic" }`. Drop the `@/modules/fonts` import.
- Modify: `src/modules/element/element.mcp.ts`: `element_describe` adds `commands: string[]`, the command ids placed in the element's layout and its groups' layouts (deduplicated). Test in `element.commands.test.ts`.
- Modify: `src/modules/inspector/ui/FieldItem.tsx` (a custom field whose type isn't registered shows `"<label>" can't be shown.` / `The value type "<type>" isn't registered. Its plugin may be missing or turned off.`), `ui/ElementPanel.tsx` (`usePoint(elements)` so late-registered elements re-render), `README.md`
- Modify: `src/modules/element/README.md`

- [ ] **Step 1: Write the failing tests.**
  - `schema.test.ts`: `patchSchema({ font: prop… custom "ghost" }, { propType: () => undefined, groups: [] }).safeParse({ font: {} }).success === false`. Build the spec literally as `{ kind: "custom", type: "ghost" }`.
  - `element.commands.test.ts`: a note element with a `custom` "ghost" prop logs one warning naming `value type "ghost"` (fake logger, as in the warn test); `element_describe` lists `commands` for an element whose layout has `{ command: "element.resetProps" }`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `FontRequest` still fits `FaceRequest` structurally (the engine passes `fonts.ensure`).
- [ ] **Step 4: Verify.** All checks pass.
- [ ] **Step 5: Commit** `fix(element): missing value types are refused and reported; describe lists panel commands`

### Task 7: UI polish (R15, R17, D4)

**Files:**

- Modify: `src/modules/timeline/ui/TimelineClip.tsx` (one selector returning `` `${color}\n${body}\n${label}` ``, split after; strings are stable)
- Modify: `src/modules/text/ui/TextPanel.tsx` (drop the "Add text" button; keep the header and `CreateTiles`), `src/modules/text/README.md`
- Modify: `src/modules/inspector/logic/live.ts`, `logic/live.test.ts`, `README.md`

**Rule D4:** `commit` takes the pending patch and resets `pending` **before** the command runs. When the command settles, the preview is cleared only if nothing new was input meanwhile; otherwise it shows the new pending patch.

- [ ] **Step 1: Write the failing test** in `live.test.ts`: `input({ size: 12 })`, `commit({})` (the commit promise is held open by a deferred), `input({ size: 14 })`, then resolve. Expected: the last preview is `{ size: 14 }` (not null), and a later `commit({})` sends `{ size: 14 }`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the three changes.
- [ ] **Step 4: Verify.** All checks pass.
- [ ] **Step 5: Commit** `fix: one display selector per timeline clip; one add path in the Text tab; live input survives a pending commit`

### Task 8: Remaining test gap, docs, chunk check (R13 docs, R16 part 2, D5)

**Files:**

- Modify: `src/modules/timeline/timeline.commands.test.ts`: a start-edge trim of a text clip keeps `sourceIn` 0 and moves `start`.
- Modify: `docs/superpowers/specs/2026-10-29-elements-design.md` (settled calls 7–8 and the Names table: `timeline.addElement` / `timeline_add_element`; `element_describe` lists `commands`), `docs/superpowers/plans/2026-10-29-elements.md` (Global Constraints: same names)

- [ ] **Step 1: Write the test.** Run it. If it passes at once (the logic already exists), say so in the commit body: it's a regression pin.
- [ ] **Step 2: Update the docs.**
- [ ] **Step 3: Check D5.** Run `git worktree add /tmp/cc-base 9045239 && cd /tmp/cc-base && pnpm install --offline && pnpm build 2>&1 | grep -c "larger than 500 kB"`, then remove the worktree. Report whether the warning predates this work. Change no code.
- [ ] **Step 4: Verify.** All checks pass.
- [ ] **Step 5: Commit** `test(timeline): text start trim keeps sourceIn; docs: addElement names`
