# Solid colors, composite and gradients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish solid colors, add a Composite section (blend mode and opacity) to every picture clip, and add linear and radial gradients to solids and text fill.

**Architecture:** Composite is a shared group, like `transform`, drawn by the preview engine through a scratch canvas, so export gets it from the same code. A solid follows the frame because its size defaults to the format. `gradient` becomes a built-in value kind in `element`.

**Tech Stack:** TypeScript, React 19, Zod 4, canvas 2D, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-solids-composite-gradients-design.md`

## File Tree

`+` is a new file, `~` is an edited file. Nothing is removed. Task 9's pass prunes tests.

```
cloudy-clip/
├─ ~ CLAUDE.md                                   product line, scope, Where to look
├─ docs/
│  ├─ ~ modules.md                               the solid row
│  └─ superpowers/specs/
│     └─ + 2026-11-02-blend-preview-check.md     what Task 3 found
└─ src/
   ├─ ui/
   │  ├─ kit/+ GradientField.tsx                 type, stop bar, angle, stop color
   │  ├─ kit/~ kit.types.ts                      GradientValue, GradientValueStop
   │  ├─ ~ index.ts
   │  └─ ~ README.md
   └─ modules/
      ├─ project/
      │  ├─ ~ project.types.ts                   BlendMode, ClipComposite, Gradient, Solid
      │  ├─ ~ project.geometry.ts                IDENTITY_COMPOSITE, clipComposite
      │  ├─ ~ index.ts
      │  └─ ~ README.md
      ├─ element/
      │  ├─ ~ element.types.ts                   PropKind gradient, followsFrame
      │  ├─ ~ element.mcp.ts                     wording
      │  ├─ ~ index.ts
      │  ├─ ~ README.md
      │  └─ logic/
      │     ├─ + gradient.ts                     line, paint, CSS, default
      │     ├─ + schema.test.ts
      │     ├─ ~ props.ts                        prop.gradient, default control
      │     └─ ~ schema.ts                       gradientSchema
      ├─ transform/
      │  ├─ + transform.composite.group.ts       the composite shared group
      │  ├─ + transform.composite.test.ts
      │  ├─ ~ transform.module.ts
      │  └─ ~ README.md
      ├─ preview/
      │  ├─ logic/+ blend.ts                     canvasBlend
      │  ├─ engine/+ engine.composite.ts         landLayer
      │  ├─ engine/~ engine.html.ts              clips through the layer
      │  ├─ engine/~ engine.mix.ts               layer(), result(), junction blend
      │  ├─ engine/~ engine.types.ts             ClipDrawer
      │  └─ ~ README.md
      ├─ inspector/
      │  ├─ ui/controls/+ GradientControl.tsx
      │  ├─ ui/controls/~ index.ts
      │  └─ ~ README.md
      ├─ solid/
      │  ├─ ~ solid.element.ts                   follows the frame, fill, layout
      │  ├─ ~ solid.commands.ts                  optional sizes, gradient
      │  ├─ ~ solid.commands.test.ts
      │  ├─ ui/~ SolidDialog.tsx                 edit mode, Match frame, gradient
      │  ├─ ui/~ SolidTile.tsx                   menu, double click, gradient
      │  └─ ~ README.md
      ├─ composition/
      │  ├─ ~ composition.element.ts             supports composite
      │  ├─ ~ composition.settings.commands.ts   skips following clips
      │  └─ ~ README.md
      ├─ text/
      │  ├─ ~ text.element.ts                    fill type and gradient
      │  ├─ ~ text.types.ts
      │  ├─ ~ text.draw.ts
      │  ├─ logic/~ layout.ts                    defaults
      │  ├─ logic/~ presets.ts                   type: "color"
      │  ├─ ui/~ TextEditor.tsx                  gradient while editing
      │  └─ ~ README.md
      ├─ media/~ media.element.ts                supports composite
      ├─ sticker/~ sticker.element.ts            supports composite
      └─ workspace/logic/
         ├─ ~ format.ts                          a solid's size is optional
         └─ ~ format.test.ts
```

## Global Constraints

- Read each folder's `README.md` first and update it in the same commit, in the template of `docs/modules.md`.
- A task is done when `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
- Tests only as CLAUDE.md rule 3 allows. This plan lists all of them. Add no others, and check picture behaviour in the real app.
- Every change is a command through the bus. A gesture sends one command on release.
- Never `willReadFrequently` on any canvas: it draws video black on WebKitGTK.
- No React state on per-frame paths (rule 24).
- Never add a `Co-Authored-By` line to a commit message.
- Work on branch `solids-composite-gradients` in its own worktree, because the keyframes plan is committing to `master` in the main folder. Don't touch the main folder or the app running there. Rebase on `master` before finishing.
- Real-app checks run on their own ports, never against the app on 1420 and 7420.
- Composite and gradients must not get in the way of keys: `opacity` and `mode` are keyable as they stand, and `gradient` isn't, since `keyableFields` doesn't list that kind.

## Review Focus

CLAUDE.md rule 3 keeps these out of the test suite, so Tasks 3 and 9 check them in the real app.

- A text clip at 50% opacity with a shadow and outline fades as one picture, with no darker overlaps.
- A clip in Multiply under a transition shows no flash at the start or end of the overlap when both clips share the mode.
- A following solid inside a placed composition fills that composition, not the outer one.
- Undoing a mode change returns the picture at once, and a clip back at Normal and 100% stores no `composite`.
- Export of a Multiply or Screen stack matches `preview_capture_frame` of that frame, apart from the Linux video range.

---

### Task 1: Composite values and section

**Files:**

- Modify: `src/modules/project/project.types.ts`, `src/modules/project/project.geometry.ts`, `src/modules/project/index.ts`, `src/modules/project/README.md`
- Create: `src/modules/transform/transform.composite.group.ts`, `src/modules/transform/transform.composite.test.ts`
- Modify: `src/modules/transform/transform.module.ts`, `src/modules/transform/README.md`
- Modify: `supports` in `src/modules/media/media.element.ts`, `src/modules/text/text.element.ts`, `src/modules/sticker/sticker.element.ts`, `src/modules/solid/solid.element.ts`, `src/modules/composition/composition.element.ts`
- Modify: the `(transform)` wording in the description in `src/modules/element/element.mcp.ts`

**Interfaces:**

- Produces, from `@/modules/project`:
  - `BLEND_MODES`: `as const` array of `"normal" | "add" | "multiply" | "screen" | "overlay" | "softLight" | "hardLight" | "darken" | "lighten" | "colorDodge" | "colorBurn" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity"`, in this order
  - `type BlendMode`, `interface ClipComposite { mode: BlendMode; opacity: number }`
  - `SharedGroupValues.composite: ClipComposite`
  - `IDENTITY_COMPOSITE: Readonly<ClipComposite>` (`normal`, `1`)
  - `clipComposite(clip: Clip, live?: Partial<ClipComposite>): ClipComposite`, shaped like `clipTransform`: it merges the clip's value and the live one over `IDENTITY_COMPOSITE`, because keyframes' `animatedClip` writes shared values that may be partial (only the keyed field)
- Produces, from `@/modules/transform`: `compositeGroup`

- [ ] **Step 1: Write the failing test** `transform.composite.test.ts`, with the kernel setup of `solid.commands.test.ts`. Add a text clip with `addElement`:
  - `setProps` with `{ composite: { mode: "multiply", opacity: 0.5 } }` gives `clip.composite` `{ mode: "multiply", opacity: 0.5 }`
  - `setProps` with `{ composite: { mode: "normal", opacity: 1 } }` then gives `clip.composite` undefined
  - `setProps` with `{ composite: { mode: "subtract" } }` fails with `element.invalid_props`

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/modules/transform/transform.composite.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the project values.** Add the types next to `SharedGroupValues`, the two values next to `IDENTITY_TRANSFORM`, and export them.

- [ ] **Step 4: Add `compositeGroup`** with `defineSharedGroup`:
  - id and key `composite`, label `Composite`, order 910
  - `mode`: `prop.enum(BLEND_MODES, { labels })`, labels as in the spec's list
  - `opacity`: `prop.number({ min: 0, max: 1, step: 0.01, control: "slider", display: { scale: 100, unit: "%" } })`
  - `defaults: () => ({ ...IDENTITY_COMPOSITE })`
  - `appliesTo` as `transformGroup`
  - `layout: { title: "Composite", order: 910, tab: "video", items: ["mode", "opacity"] }`

  Contribute it in `transform.module.ts`, and add `composite: true` to the five elements.

- [ ] **Step 5: Run the test and the checks**

Run: `pnpm vitest run src/modules/transform/transform.composite.test.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit** `feat(transform): composite values and their section`

### Task 2: Draw composite in the engine

**Files:**

- Create: `src/modules/preview/logic/blend.ts`, `src/modules/preview/engine/engine.composite.ts`
- Modify: `src/modules/preview/engine/engine.html.ts`, `src/modules/preview/engine/engine.mix.ts`, `src/modules/preview/engine/engine.types.ts`, `src/modules/preview/README.md`

**Interfaces:**

- Consumes: `clipComposite`, `ClipComposite`, `BlendMode`, `IDENTITY_COMPOSITE`
- Produces:
  - `canvasBlend(mode: BlendMode): GlobalCompositeOperation` in `logic/blend.ts`. `normal` → `source-over`, `add` → `lighter`, `softLight` → `soft-light`, `hardLight` → `hard-light`, `colorDodge` → `color-dodge`, `colorBurn` → `color-burn`; every other mode keeps its name
  - `landLayer(target, source: HTMLCanvasElement, composite: ClipComposite): void` in `engine.composite.ts`: `save`, identity transform, alpha, blend, `drawImage(source, 0, 0)`, `restore`
  - `MixCanvases.layer()` and `MixCanvases.result()`: indices 2 and 3 of its pooled canvases, prepared as `a()` and `b()`
  - `ClipDrawer = (target, clip, blend?: boolean) => void`, where `blend` defaults to true

- [ ] **Step 1: Route clips through the layer.** In `drawFrame`, rename today's closure body to a local `paint(on, clip)`, and make `drawClip(on, clip, blend = true)`:

```ts
const live = propsOverrides.get(clip.id)?.composite as Partial<ClipComposite> | undefined;
const composite = clipComposite(clip, live);
const mode = blend ? composite.mode : "normal";
if (mode === "normal" && composite.opacity === 1) return paint(on, clip);
const layer = mix.layer();
paint(layer, clip);
landLayer(on, layer.canvas, { mode, opacity: composite.opacity });
```

- [ ] **Step 2: Handle junctions in `drawTrack`.** Draw both sides with `drawClip(a, left, false)` and `drawClip(b, clip, false)`. Read `clipComposite(left).mode` and `clipComposite(clip).mode`. When they are equal and not `normal`, call `mix` on `canvases.result()` and land it with that mode at opacity 1 once the `try/finally` has finished. Otherwise call `mix` on `ctx` as today. The fallback in `catch` draws on the same target as the mix.

- [ ] **Step 3: Update the preview README:** the composite path, junction rule and placement rule from the spec. No test here: this needs a real canvas, and Task 3 checks it.

- [ ] **Step 4: Run the checks**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit** `feat(preview): draw blend modes and opacity`

### Task 3: Prove blending in the real app

**Files:**

- Create: `docs/superpowers/specs/2026-11-02-blend-preview-check.md`, in the shape of `2026-11-02-audio-preview-check.md`
- Modify: `src/modules/preview/README.md`

- [ ] **Step 1: Start the app** with `pnpm tauri dev`, import a real video through the MCP tools, and put a text clip and a solid above it.

- [ ] **Step 2: Check each mode.** Set each of the 17 modes on the solid with `element_set_props`, and look at each frame with `preview_capture_frame`. Expected: a different, correct picture for each mode, with video never black. Check also that the live window shows the same picture and plays smoothly.

- [ ] **Step 3: Check the Review Focus items.** Set the text to 50% with shadow and outline, and put a Multiply pair under a transition. Scrub across the overlap's start and end.

- [ ] **Step 4: Measure the Linux range.** Compare Screen over video in a capture and in one exported frame. Write the difference to the check file and one line to the preview README.

- [ ] **Step 5: Decide.** If a mode draws wrongly or video goes black, **stop and report it** before starting Task 4. Tasks 4 to 8 don't depend on blending, so they can go ahead if the user says so.

- [ ] **Step 6: Commit** `docs(preview): what the blend check found`

### Task 4: The gradient value

**Files:**

- Modify: `src/modules/project/project.types.ts`, `src/modules/project/index.ts`
- Modify: `src/modules/element/element.types.ts`, `src/modules/element/logic/props.ts`, `src/modules/element/logic/schema.ts`, `src/modules/element/index.ts`, `src/modules/element/README.md`
- Create: `src/modules/element/logic/gradient.ts`, `src/modules/element/logic/schema.test.ts`

**Interfaces:**

- Produces, from `@/modules/project`: `GradientStop`, `Gradient`, as in the spec
- Produces, from `@/modules/element`:
  - `PropKind` gains `"gradient"`; `prop.gradient(o: PropUi = {}): PropSpec<Gradient>`; `defaultControl` gives `"gradient"`
  - `gradientSchema`: strict Zod object. `type` an enum, `angle` number from -3600 to 3600, `stops` an array of 2 to 8 strict `{ at, color, opacity }`. `at` and `opacity` from 0 to 1. `color` is `z.string().toLowerCase().regex(/^#[0-9a-f]{6}$/)`
  - `DEFAULT_GRADIENT: Readonly<Gradient>`
  - `gradientLine(gradient, width, height): { x0, y0, x1, y1 }`, for a box centered on the origin
  - `gradientPaint(ctx, gradient, width, height): CanvasGradient`, for a box centered on the origin
  - `gradientCss(gradient): string`, with stops sorted by `at`

- [ ] **Step 1: Write the failing test** `schema.test.ts`, through `patchSchema` over `{ g: prop.gradient() }`:
  - a two-stop gradient with `#AABBCC` parses, and its color comes back lowercase
  - one stop fails, nine stops fail, a stop with `at: 2` fails, an unknown key fails
  - `gradientLine({ type: "linear", angle: 0, stops }, 100, 50)` is `{ x0: -50, y0: 0, x1: 50, y1: 0 }`
  - `gradientLine` at `angle: 90` for the same box has `y0` -25 and `y1` 25

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/modules/element/logic/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the types, builder, `valueSchema` case and `gradient.ts`. Geometry is in the spec. `gradientPaint` uses `createLinearGradient` or `createRadialGradient(0, 0, 0, 0, 0, Math.hypot(width, height) / 2)`, and each stop's color as `rgba`. `gradientCss` gives `linear-gradient((angle + 90)deg, …)` or `radial-gradient(farthest-corner, …)`, since CSS 0deg points up.

- [ ] **Step 4: Run the test and the checks**

Run: `pnpm vitest run src/modules/element/logic/schema.test.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. Also check that the `element_describe` output builds for a gradient field.

- [ ] **Step 5: Commit** `feat(element): the gradient value`

### Task 5: The gradient control

**Files:**

- Create: `src/ui/kit/GradientField.tsx`, `src/modules/inspector/ui/controls/GradientControl.tsx`
- Modify: `src/ui/kit/kit.types.ts`, `src/ui/index.ts`, `src/ui/README.md`, `src/modules/inspector/ui/controls/index.ts`, `src/modules/inspector/README.md`

**Interfaces:**

- Consumes: `Gradient`, `FieldControlProps`, `ColorField`, `SegmentedControl`, `NumberField`, `Button`
- Produces:
  - `GradientValue` and `GradientValueStop` in `kit.types.ts`, shaped like `Gradient` (`@/ui` imports no module)
  - `GradientField` props: `label`, `value: GradientValue`, `onChange(value, info: ColorChangeInfo)`, `recents?`, `swatches?`, `disabled?`
  - control id `gradient`, `for: "field"`

- [ ] **Step 1: Build `GradientField`:** the Linear or Radial segmented control, the bar, the angle (linear only), and the selected stop's `ColorField` with opacity. A click on the bar adds a stop at that spot, with the color there, up to 8. Remove is disabled at 2 stops. A stop's position is clamped to 0–1.

- [ ] **Step 2: Keep dragging off React state.** A drag moves the handle and the bar's background through refs and `style`, and sends `onChange` with `done: false`. Release sends it once with `done: true`. Selecting a stop is ordinary state.

- [ ] **Step 3: Add `GradientControl`,** following `ColorControl`: `info.done` false → `live.input(pathPatch(path, next))`, else `live.commit(...)` and push the stop's color to the recents. Register it in `builtinControls`.

- [ ] **Step 4: Run the checks**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit** `feat(inspector): the gradient control`

### Task 6: Solid clips follow the frame and take a gradient

**Files:**

- Modify: `src/modules/element/element.types.ts`, `src/modules/element/README.md`
- Modify: `src/modules/solid/solid.element.ts`, `src/modules/solid/solid.commands.test.ts`, `src/modules/solid/README.md`
- Modify: `src/modules/composition/composition.settings.commands.ts`, `src/modules/composition/README.md`

**Interfaces:**

- Consumes: `prop.gradient`, `gradientPaint`, `DEFAULT_GRADIENT`
- Produces: `PictureDefinition.followsFrame?(clip: Clip): boolean`; solid props `fillType: "color" | "gradient"`, `gradient: Gradient`

- [ ] **Step 1: Add the failing tests** to `solid.commands.test.ts`. Add `compositionModule` and `setSettings` as the setup needs:
  - a solid added with no props in a 1920×1080 composition resolves to 1080×1920 after `setSettings` changes the format to that size, and `clip.props` holds no `width`
  - `setSettings` with `resize: "scale"` leaves that clip's `transform` undefined
  - a clip added with `width: 500, height: 500` keeps those after the format changes, and its `transform.scale` does change under `resize: "scale"`

- [ ] **Step 2: Run them**

Run: `pnpm vitest run src/modules/solid`
Expected: FAIL.

- [ ] **Step 3: Change the element:**
  - `defaults: (format) => ({ fillType: "color", color: "#000000", gradient: DEFAULT_GRADIENT, width: format.width, height: format.height })`
  - unhide `width` and `height`, with `keyframes: false`, because a keyed size can't follow the frame
  - `fillType` is an enum labeled Color and Gradient; `color` and `gradient` show by `visibleWhen`
  - `layout`: section Fill with `fillType`, `color`, `gradient`; section Size with a `{ row: ["width", "height"], label: "Size" }`
  - `followsFrame: (clip) => clip.props.width === undefined && clip.props.height === undefined`
  - `drawSolid` sets `fillStyle` to `gradientPaint(ctx, gradient, place.width, place.height)` for a gradient, in the translated, rotated space it draws in

- [ ] **Step 4: Skip following clips** in `setSettings`: with `resize: "scale"`, `continue` when `definition.picture.followsFrame?.(clip)`, so neither the transform nor its keys are scaled. Add it to the `setSettings` description.

- [ ] **Step 5: Run the tests and the checks**

Run: `pnpm vitest run src/modules/solid && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit** `feat(solid): clips follow the frame and take a gradient`

### Task 7: Library solids, complete

**Files:**

- Modify: `src/modules/project/project.types.ts`, `src/modules/workspace/logic/format.ts`, `src/modules/workspace/logic/format.test.ts`
- Modify: `src/modules/solid/solid.commands.ts`, `src/modules/solid/solid.commands.test.ts`, `src/modules/solid/ui/SolidDialog.tsx`, `src/modules/solid/ui/SolidTile.tsx`, `src/modules/solid/README.md`

**Interfaces:**

- Consumes: `gradientSchema`, `gradientCss`, `GradientField`, `ContextMenu`, `Switch`
- Produces: `Solid { id; name; color; width?; height?; fillType?; gradient?; binId? }`; `SolidDialog({ solid?: Solid; onClose })`; `CommandFailure("solid.invalid_size", …)`

- [ ] **Step 1: Add the failing tests:**
  - `solid.create` with no size stores no `width`, and `#AABBCC` is stored lowercase
  - `solid.create` with only `width` fails with `solid.invalid_size`
  - `solid.update` with `width: null, height: null` removes both
  - in `format.test.ts`, a file whose solid has no size opens, and one with a size keeps it

- [ ] **Step 2: Run them**

Run: `pnpm vitest run src/modules/solid src/modules/workspace/logic/format.test.ts`
Expected: FAIL.

- [ ] **Step 3: Change the commands.** `color` becomes `z.string().toLowerCase().regex(...)`. Create takes optional `width`, `height`, `fillType` and `gradient`. Update takes `width` and `height` nullable, so null clears them. Both refuse one size without the other, before writing. Update the descriptions and README table. In `format.ts`, make `width` and `height` optional.

- [ ] **Step 4: Change the dialog.** With `solid` it is titled "Edit solid color", starts from that solid and runs `updateSolid`. Without it, it runs `createSolid`. Add the Match frame switch, on by default for a new solid, which hides Size. Add the Color or Gradient choice, using `GradientField` for a gradient.

- [ ] **Step 5: Change the tile.** Draw `gradientCss` when `fillType` is `gradient`. Wrap it in `ContextMenu` with Edit and Remove (destructive), and open the dialog on a double click. Dragging sends `{ color, fillType, gradient }`, with `width` and `height` only when set. The title reads "Match frame" when it has no size.

- [ ] **Step 6: Run the tests and the checks**

Run: `pnpm vitest run src/modules/solid src/modules/workspace/logic/format.test.ts && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit** `feat(solid): edit library solids, match frame and gradients`

### Task 8: Gradient text fill

**Files:**

- Modify: `src/modules/text/text.types.ts`, `src/modules/text/text.element.ts`, `src/modules/text/text.draw.ts`, `src/modules/text/logic/layout.ts`, `src/modules/text/logic/presets.ts`, `src/modules/text/ui/TextEditor.tsx`, `src/modules/text/README.md`

**Interfaces:**

- Consumes: `prop.gradient`, `gradientPaint`, `gradientCss`, `DEFAULT_GRADIENT`
- Produces: `TextFill { type: "color" | "gradient"; color; opacity; gradient: Gradient }`

- [ ] **Step 1: Extend the `fill` group:** add `type`, an enum labeled Color and Gradient; add `gradient`, and show `color` and `gradient` by `visibleWhen`, as functions reading `values.fill`. `defaultTextStyle` gives `type: "color"` and `DEFAULT_GRADIENT`. Each preset's `fill` gains `type: "color"`.

- [ ] **Step 2: Draw it.** In `drawText`, set `fillStyle` to `gradientPaint(ctx, fill.gradient, layout.box.width, layout.box.height)` when `fill.type` is `gradient`. Create it once, before the lines loop. Keep `globalAlpha = fill.opacity`.

- [ ] **Step 3: Show it while editing.** In `TextEditor`, for a gradient use `background: gradientCss(...)`, `backgroundClip: "text"`, `WebkitBackgroundClip: "text"` and `color: "transparent"`. Set `caretColor` to the first stop's color.

- [ ] **Step 4: Run the checks**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. A test that fails on the new `fill` keys gets updated values, not a new test.

- [ ] **Step 5: Commit** `feat(text): gradient fill`

### Task 9: Finish in the real app

**Files:**

- Modify: `CLAUDE.md`, `docs/modules.md`, and any README still out of date

- [ ] **Step 1: Run a pass in the app,** as a user with no MCP:
  - make a Match frame gradient solid in the dialog, drag it in, and change the composition to 9:16: it still fills
  - edit the library solid: the clip doesn't change
  - put a gradient on text and edit it in place
  - apply a preset to gradient text: it goes back to a color
  - set a mode and opacity in the panel, reset them from the band, undo: one step each

- [ ] **Step 2: Check the rest of Review Focus:** a following solid inside a placed composition; a blended clip on a placed composition; save, reopen, and everything is still there.

- [ ] **Step 3: Export a real clip** with a Multiply stack, a gradient solid and gradient text, and compare a frame with `preview_capture_frame`. Differences beyond the range in Task 3's check are bugs.

- [ ] **Step 4: Update `CLAUDE.md`:** the first line says professional underneath and easy on the surface; the scope line lists composite and gradients; `solid/` and `transform/` in Where to look. Update the `solid` row in `docs/modules.md`.

- [ ] **Step 5: Run everything**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit** `docs: composite, gradients and solid colors in the project guide`
