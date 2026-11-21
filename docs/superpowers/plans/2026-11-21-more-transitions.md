# More Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 26 new transition tiles (33 in all) from 13 new routines, with shared options and real GPU motion blur.

**Architecture:** A mix gets an optional `env.gpu` (the engine's WebGL2 runner, now taking two
sources) and a `env.withoutGpu()` hook; every GPU preset keeps a plain 2D path. Variants are extra
presets made with `variantOf` from one routine; a `family` name labels the timeline chip.

**Tech Stack:** TypeScript strict, Canvas 2D, WebGL2 (GLSL ES 3.00) through `preview/gpu`, Zod via `prop.*`.

**Spec:** `docs/superpowers/specs/2026-11-21-more-transitions-design.md`

## Global Constraints

- Mixes draw with Canvas 2D: no `ctx.filter`, no `getImageData`; masks via `maskableSurface` + `destination-in`.
- No per-frame allocation in a mix: scratch canvases via `presets.cache.ts` (per owner `WeakMap`).
- `junction` (core) never imports `preview`; one definition of each GPU type (no copies).
- No legacy support: existing preset options/looks may change; nothing is migrated.
- No new tests (CLAUDE.md rule 3): presets, shaders and wiring are checked by `pnpm typecheck`, `pnpm lint`, `pnpm test` and the live check. Fix any existing test the change breaks.
- Every task ends with `pnpm typecheck && pnpm lint && pnpm test` green and a commit that stages only its own files (the tree has unrelated `src/modules/path` edits). No `Co-Authored-By` lines.
- File names dotted, types in `.types.ts`, TSDoc on every export, one concern per file (~200 lines max).
- Each new preset file starts with the line `// WebKitGTK spike not run; <how it draws> (ruling R1).` like the existing ones.

## Review Focus

Checked by reviewers and the live check (no DOM/WebGL in Vitest, so no tests):

1. Export with WebGL2 unavailable on a GPU preset must fail with a message, never write the 2D look (Task 1).
2. Live preview with no GPU: GPU presets draw their 2D path and the user gets exactly one notice per kernel (Task 1).
3. Existing filter, mask and Tint passes still sample `inputs: -1` as before after the two-source change (Task 1).
4. Changing a variant's `direction` in the inspector: the chip shows the family name, never a wrong direction (Task 2).
5. A GPU preset at progress 0 and 1 draws exactly A and exactly B (no leftover blur, no shift), at every `intensity` (Tasks 4–7).

## Models

| Task | Implementer | Reviewer | Why |
| ---- | ----------- | -------- | --- |
| 1 GPU in a mix | opus | opus | cross-layer, export parity, WebGL state |
| 2 Shared options, variants, family | sonnet | sonnet | clear, spec'd |
| 3 Shaders | opus | sonnet | shader math |
| 4 Shape wipes (iris, clock, split, blink) | sonnet | sonnet | 2D, clear |
| 5 Motion (push, slide) | sonnet | sonnet | 2D + one shader call |
| 6 Camera (zoom, spin, shake) | sonnet | opus | GPU + fallback + thumbnails |
| 7 Light & distort (leak, pixelate, luma, ripple) | sonnet | sonnet | clear |
| 8 Docs and changelogs | haiku | haiku | mechanical |
| Final whole-branch review | — | opus | |

## File tree

```
src/modules/junction/
  junction.types.ts            M  GpuInt/GpuUniform/GpuTexture/GpuPass moved here; MixGpu; MixEnv.gpu, MixEnv.withoutGpu
  index.ts                     M  export the moved types and MixGpu
  README.md                    M  MixEnv.gpu, withoutGpu, export rule
src/modules/preview/
  gpu/gpu.types.ts             M  re-export the moved types from @/modules/junction; run() takes one or more sources; GpuContext.sources
  gpu/gpu.runner.ts            M  upload each source; input -1 → source 0, -2 → source 1
  engine/engine.mix.ts         M  drawTrack builds env.gpu / env.withoutGpu; strict rethrow of GpuUnavailable
  engine/engine.html.ts        M  pass the mix GPU host to drawTrack
  engine/engine.types.ts       M  EngineOptions.mixWithoutGpu?()
  preview.filters.ts           M  mixWithoutGpu(): one notice per kernel
  preview.types.ts             M  PreviewFilters.mixWithoutGpu
  preview.module.ts            M  wire mixWithoutGpu into the live engine
  README.md                    M  two-source runs, env.gpu
src/modules/transition/
  transition.types.ts          M  family?: string; category union gains motion/camera/light/distort
  transition.points.ts         M  variantOf()
  transition.kind.ts           M  chip label family ?? name
  index.ts                     M  export variantOf
  logic/categories.ts          M  order basic, motion, camera, light, blur, distort, glitch, overlay
  logic/easing.ts              M  eased(props, t, fallback)
  logic/gpu.ts                 A  zoomBlurPass, spinBlurPass, directionalBlurPass, lumaKeyPass, ripplePass, mixPasses
  presets/presets.props.ts     A  easeProp, intensityProp, softnessProp
  presets/presets.ts           M  list every tile in tab order
  presets/fade.ts              M  + dip-white variant
  presets/wipe.ts              M  + ease; family "Wipe"; + wipe-down variant
  presets/woosh.ts             M  direction up/down; + woosh-up variant
  presets/glitch.ts            M  slices option; + rgb-split variant
  presets/iris.ts              A  iris-open, iris-close
  presets/clock.ts             A  clock
  presets/split.ts             A  split-h, split-v
  presets/blink.ts             A  blink
  presets/push.ts              A  push-left/right/up/down
  presets/slide.ts             A  slide-left, slide-up
  presets/zoom.ts              A  zoom-in, zoom-out
  presets/spin.ts              A  spin, spin-ccw
  presets/shake.ts             A  shake
  presets/leak.ts              A  light-leak, film-burn
  presets/pixelate.ts          A  pixelate
  presets/luma.ts              A  luma-fade
  presets/ripple.ts            A  ripple
  ui/thumbnail.hook.ts         M  env.withoutGpu no-op
  README.md                    M  presets table, options, variants, GPU
CHANGELOG.md, CHANGELOG.es.md  M  one entry each
```

---

### Task 1: GPU inside a mix (opus / review opus)

**Files:** junction `junction.types.ts`, `index.ts`, `README.md`; preview `gpu/gpu.types.ts`, `gpu/gpu.runner.ts`, `engine/engine.mix.ts`, `engine/engine.html.ts`, `engine/engine.types.ts`, `preview.filters.ts`, `preview.types.ts`, `preview.module.ts`, `README.md`; transition `ui/thumbnail.hook.ts`.

**Interfaces:**
- Produces (in `junction.types.ts`, exported from `@/modules/junction`):
  - `GpuInt`, `GpuUniform`, `GpuTexture`, `GpuPass` — moved verbatim from `preview/gpu/gpu.types.ts`; `GpuPass.inputs` doc: `-1` is source 0, `-2` source 1, `n` the output of pass `n`.
  - `interface MixGpu { run(sources: readonly CanvasImageSource[], size: { width: number; height: number }, passes: readonly GpuPass[]): CanvasImageSource }` — returns a shared canvas; draw it before the next `run`.
  - `MixEnv.gpu?: MixGpu` and `MixEnv.withoutGpu(): void` — "call when drawing the plainer 2D path for want of `gpu`".
- Produces (preview): `GpuRunner.run(source: TexImageSource | readonly TexImageSource[], size, passes)`; `GpuContext.sources: WebGLTexture[]` (replaces `source`, grown on demand, all deleted in `closeContext`); `EngineOptions.mixWithoutGpu?(): void`; `PreviewFilters.mixWithoutGpu(): void`.
- `@/modules/preview` keeps exporting `GpuPass`, `GpuTexture`, `GpuUniform` (re-exported), so `tint` is untouched.

- [ ] **Step 1: Move the four GPU types** to `junction.types.ts`; `preview/gpu/gpu.types.ts` imports them with `import type` and re-exports them. Run `pnpm typecheck` — expect PASS.
- [ ] **Step 2: Two sources in the runner.** In `runPasses`, upload `sources[i]` into `context.sources[i]`; bind `input < 0 ? context.sources[-input - 1]! : outputs[input]!.texture`. A pass naming a source that wasn't given throws `Error("Pass <key> reads source <n>, which wasn't given")`.
- [ ] **Step 3: Wire the mix** in `engine/engine.mix.ts`. `drawTrack` gets a last parameter `gpu: MixGpuHost` (type in `engine.types.ts`: `{ runner?: GpuRunner; strict: boolean; withoutGpu(): void }`). Per mix:
  - `env.gpu` = a `MixGpu` over `runner` when `runner?.available`, else absent. The wrapper passes `sources` as `TexImageSource[]` (they are the pool's canvases; one cast with that comment).
  - `env.withoutGpu` = `strict ? () => { throw new GpuUnavailable() } : host.withoutGpu`.
  - In the existing `catch`: `if (host.strict && error instanceof GpuUnavailable) throw error;` before the "right over left" fallback.
  - `engine.html.ts` builds the host once in the constructor: `{ runner: options.gpu, strict: (options.filterTarget ?? "preview") !== "preview", withoutGpu: () => options.mixWithoutGpu?.() }` and passes it at both `drawTrack` calls (`engine.html.ts:596` and `:611`; nested placements go through the same two, so `engine.nested.ts` doesn't change).
- [ ] **Step 4: The notice.** `preview.filters.ts` `mixWithoutGpu()`: once per kernel, `log.warn(...)` and `notify("info", "Some transitions need the graphics card; they show without blur for now.")`. Wire it in `preview.module.ts` next to `maskFailed` for the live engine only.
- [ ] **Step 5: Thumbnails.** `ui/thumbnail.hook.ts` env gets `withoutGpu: () => {}` and no `gpu`.
- [ ] **Step 6: READMEs.** junction: `MixEnv.gpu` / `withoutGpu` and the strict rule in Files and Boundaries. preview: two-source runs under the runner, and the junction paragraph (`env.gpu`, strict rethrow, `mixWithoutGpu`).
- [ ] **Step 7: Verify** `pnpm typecheck && pnpm lint && pnpm test` — all PASS. In `pnpm tauri dev`, the existing 7 transitions, a mask feather and a Tint grade look as before.
- [ ] **Step 8: Commit** `feat(junction): GPU inside a transition mix`.

### Task 2: Shared options, variants and family (sonnet / review sonnet)

**Files:** transition `transition.types.ts`, `transition.points.ts`, `transition.kind.ts`, `index.ts`, `logic/categories.ts`, `logic/easing.ts`, `presets/presets.props.ts` (new), `presets/fade.ts`, `presets/wipe.ts`, `presets/woosh.ts`, `presets/glitch.ts`, `presets/presets.ts`.

**Interfaces:**
- Consumes: `EASE_PRESETS`, `easeProgress` from `@/modules/project`.
- Produces:
  - `TransitionPresetDefinition.family?: string` (chip label); `category` union gains `"motion" | "camera" | "light" | "distort"`.
  - `variantOf(base: TransitionPresetDefinition, id: string, name: string, overrides: Record<string, unknown>): TransitionPresetDefinition` in `transition.points.ts` — `{ ...base, id, name, family: base.family ?? base.name, defaults: (f) => ({ ...base.defaults(f), ...overrides }) }`.
  - `presets/presets.props.ts`: `easeProp()` = `prop.enum(<EASE_PRESETS ids>, { label: "Ease" })`; `intensityProp()` = `prop.number({ min: 0, max: 1, step: 0.01, control: "slider", label: "Intensity" })`; `softnessProp()` = the same shape, label "Softness".
  - `logic/easing.ts`: `eased(props: Record<string, unknown>, t: number): number` — applies `EASE_PRESETS` entry `props.ease` with `easeProgress`; unknown/missing id → linear.

- [ ] **Step 1: Types, `variantOf`, `eased`, props helpers** as above; export `variantOf` from `index.ts` with TSDoc.
- [ ] **Step 2: Chip** — `transition.kind.ts` `display` returns `{ label: preset.family ?? preset.name }`.
- [ ] **Step 3: Categories** — `KNOWN_CATEGORIES = ["basic", "motion", "camera", "light", "blur", "distort", "glitch", "overlay"]`; move `glare` to `light`.
- [ ] **Step 4: Existing presets.**
  - `wipe`: name `"Left to right"`, family `"Wipe"`, add `ease` (default `"ease"`), apply `eased` to `progress`.
  - `woosh`: `direction` gains `"up" | "down"` (the same squeeze-and-stretch along height).
  - `glitch`: add `slices` (`intensityProp`-shaped, label "Slices", default 1; 0 = no slice offsets).
  - Variants: `dip-white` "Dip to white" (fade, `color: "#ffffff"`), `wipe-down` "Top to bottom" (`direction: "down"`), `woosh-up` "Woosh up" (`direction: "up"`), `rgb-split` "RGB split" (glitch, `slices: 0`).
  - `presets.ts`: `builtInPresets` lists base then variants per routine; update its doc comment (no count).
- [ ] **Step 5: Verify** `pnpm typecheck && pnpm lint && pnpm test` PASS; in the app the four new tiles appear, Glare sits under Light, and changing `wipe-down` to `right` shows the chip "Wipe".
- [ ] **Step 6: Commit** `feat(transition): shared options, variants and families`.

### Task 3: Shaders for transitions (opus / review sonnet)

**Files:** Create `src/modules/transition/logic/gpu.ts`.

**Interfaces:**
- Consumes: `GpuPass`, `MixGpu` from `@/modules/junction` (Task 1).
- Produces (each returns one `GpuPass`; `input` is `-1`, `-2` or an earlier pass index; fixed 16 samples; keys `transition.<name>`):
  - `zoomBlurPass(input: number, center: [number, number], strength: number)` — radial blur toward `center` (uv), `strength` 0..1 of the radius.
  - `spinBlurPass(input: number, center: [number, number], angle: number)` — rotational blur over `angle` radians.
  - `directionalBlurPass(input: number, dir: [number, number], length: number)` — blur along `dir`, `length` in uv.
  - `lumaKeyPass(a: number, b: number, threshold: number, softness: number, invert: boolean)` — `mix(A, B, smoothstep(threshold - softness, threshold + softness, luma(A)))`, Rec. 709 luma; `invert` flips dark-first to light-first.
  - `ripplePass(input: number, center: [number, number], amount: number, phase: number)` — sine displacement of uv from `center`.
  - `drawGpu(ctx: CanvasRenderingContext2D, gpu: MixGpu, sources: readonly CanvasImageSource[], passes: readonly GpuPass[]): void` — runs at `ctx.canvas` size and `drawImage`s the result at 0,0 full size.
- Uniform aspect: every blur pass takes `u_aspect` (width/height) so circles stay round.

- [ ] **Step 1: Write the five builders and `drawGpu`** (GLSL bodies per `GpuPass.fragment` contract: the runner adds the header, `v_uv`, `o`, and `u_in<n>` samplers). A strength/amount/length of 0 must return the input unchanged (sample count collapses to the center tap).
- [ ] **Step 2: Verify** `pnpm typecheck && pnpm lint` PASS (no caller yet; Task 6 checks the look).
- [ ] **Step 3: Commit** `feat(transition): blur, luma key and ripple passes`.

### Task 4: Shape wipes — iris, clock, split, blink (sonnet / review sonnet)

**Files:** Create `presets/iris.ts`, `presets/clock.ts`, `presets/split.ts`, `presets/blink.ts`; modify `presets/presets.ts`.

**Interfaces:** Consumes `maskableSurface`, `easeProp`, `softnessProp`, `eased`, `variantOf`, `defineTransitionPreset`.

| id → name | category, family | options (defaults) | draw |
| --------- | ---------------- | ------------------ | ---- |
| `iris-open` Circle open · `iris-close` Circle close | basic, "Circle" | direction `in\|out` (`out`; close = `in`), softness (0.15), ease (`ease`) | B masked by a radial gradient circle growing from center to frame diagonal (`out`); `in`: A masked by a shrinking circle over B |
| `clock` Clock wipe | basic | direction `cw\|ccw` (`cw`), softness (0.05), ease (`linear`) | B masked by a pie from 12 o'clock sweeping `2π·t`; softness via a second wider pie at partial alpha |
| `split-h` Split · `split-v` Split vertical | basic, "Split" | direction `horizontal\|vertical` (`horizontal`), mode `open\|close` (`open`), softness (0.1), ease (`ease`) | barn doors: B revealed by a centered band growing to full (`open`) or two bands closing from the edges (`close`) |
| `blink` Blink | light | color (`#000000`), ease (`ease`) | two lids (filled rects with a soft gradient edge) close on A by 0.5 and open on B |

- [ ] **Step 1: Write the four presets and their variants**; add them to `builtInPresets` after the wipes (blink after glare).
- [ ] **Step 2: Verify** checks PASS; in the app each tile's thumbnail animates on hover and progress 0/1 shows exactly A/B.
- [ ] **Step 3: Commit** `feat(transition): circle, clock, split and blink`.

### Task 5: Motion — push, slide (sonnet / review sonnet)

**Files:** Create `presets/push.ts`, `presets/slide.ts`; modify `presets/presets.ts`.

**Interfaces:** Consumes Task 2 helpers and `directionalBlurPass`, `drawGpu` (Task 3), `env.gpu` / `env.withoutGpu` (Task 1).

| id → name | category, family | options (defaults) | draw |
| --------- | ---------------- | ------------------ | ---- |
| `push-left` Push left · `push-right` · `push-up` · `push-down` | motion, "Push" | direction `left\|right\|up\|down` (`left`), ease (`ease`), intensity (0.5) = motion blur | A and B side by side shifted by `eased(t)·size`; with `env.gpu` and intensity > 0, the pair is drawn into a ghost canvas and blurred along the motion with length `intensity · bump(t) · 0.08`; without gpu and intensity > 0, call `env.withoutGpu()` and draw unblurred |
| `slide-left` Slide left · `slide-up` Slide up | motion, "Slide" | direction (`left`), ease (`snap`) | A still; B slides in over it from the opposite edge |

- [ ] **Step 1: Write both presets and variants**; add after the split in `builtInPresets`.
- [ ] **Step 2: Verify** checks PASS; in the app push blurs mid-move with a GPU, and with `intensity: 0` never calls `withoutGpu`.
- [ ] **Step 3: Commit** `feat(transition): push and slide`.

### Task 6: Camera — zoom, spin, shake (sonnet / review opus)

**Files:** Create `presets/zoom.ts`, `presets/spin.ts`, `presets/shake.ts`; modify `presets/presets.ts`.

**Interfaces:** Consumes Task 2 helpers, `zoomBlurPass`, `spinBlurPass`, `directionalBlurPass`, `drawGpu`, `ghostCanvas`, `env.random`.

| id → name | family | options (defaults) | draw |
| --------- | ------ | ------------------ | ---- |
| `zoom-in` Zoom in · `zoom-out` Zoom out | "Zoom" | direction `in\|out` (`in`), intensity (0.6), ease (`ease`) | cut at 0.5; A scales 1→(1+intensity) (in) or 1→1/(1+intensity) shown with B from the inverse; radial blur strength `intensity · bump(t)` around the center |
| `spin` Spin · `spin-ccw` Spin left | "Spin" | direction `cw\|ccw` (`cw`), intensity (0.6), ease (`ease`) | cut at 0.5; rotate by `±π/2 · eased(t)` mirrored after the cut, scale 1+0.3·bump so corners stay covered; rotational blur `angle = intensity · bump(t) · 0.6` |
| `shake` Shake | — | intensity (0.5) | cut at 0.5; offsets from `env.random()` per frame step (12 steps over the transition) scaled by `intensity · bump(t) · 0.04 · width`; directional blur along the last offset |

Each: when `env.gpu` is absent and the blur amount > 0, call `env.withoutGpu()` once per draw and draw the transform without blur. Each gets a `thumbnail` that suggests the blur with 4 stacked copies at decreasing alpha (no GPU in thumbnails).

- [ ] **Step 1: Write the three presets, variants and thumbnails**; add a "camera" block after push/slide.
- [ ] **Step 2: Verify** checks PASS; live: zoom/spin blur peaks at the cut, progress 0/1 are exact A/B at intensity 1; export a 2 s clip pair with `zoom-in` and compare a mid frame with the preview.
- [ ] **Step 3: Commit** `feat(transition): zoom, spin and shake`.

### Task 7: Light and distort — leak, pixelate, luma, ripple (sonnet / review sonnet)

**Files:** Create `presets/leak.ts`, `presets/pixelate.ts`, `presets/luma.ts`, `presets/ripple.ts`; modify `presets/presets.ts`.

| id → name | category, family | options (defaults) | draw |
| --------- | ---------------- | ------------------ | ---- |
| `light-leak` Light leak · `film-burn` Film burn | light, "Light leak" | color (`#ffb347`; burn `#ff5a1f`), intensity (0.7; burn 1) | cross-dissolve A→B under 3 radial gradient blobs (positions from `env.random()`, drifting with `t`) added with `lighter` at `intensity · bump(t)` |
| `pixelate` Pixelate | distort | intensity (0.6) | cut at 0.5; draw the source into a scratch canvas `max(1, width / (1 + 63·intensity·bump(t)))` wide with `imageSmoothingEnabled = false`, then scale back up |
| `luma-fade` Luma fade | distort | direction `dark\|light` (`dark`), softness (0.1) | GPU: `lumaKeyPass(-1, -2, t·(1+2s)−s, s, light)`; without gpu: `env.withoutGpu()` and a cross dissolve |
| `ripple` Ripple | distort | intensity (0.5) | GPU: `ripplePass` on A then B, amount `intensity·bump(t)·0.03`, cross-dissolve between them (one run with both sources); without gpu: `withoutGpu()` and a cross dissolve |

- [ ] **Step 1: Write the four presets and the film-burn variant**; add them in category order.
- [ ] **Step 2: Verify** checks PASS; live: luma fade reveals dark areas first, `direction: light` the reverse.
- [ ] **Step 3: Commit** `feat(transition): light leak, pixelate, luma fade and ripple`.

### Task 8: Docs and changelogs (haiku / review haiku)

**Files:** `src/modules/transition/README.md`, `CHANGELOG.md`, `CHANGELOG.es.md`.

- [ ] **Step 1: transition README** (README template): Presets table with all 33 tiles (category, id, name, look); a Variants paragraph (`variantOf`, `family` on the chip); shared options (`ease`, `direction`, `intensity`, `softness`, `color`); GPU paragraph (`env.gpu`, `withoutGpu`, thumbnails stay 2D); Files list gains `logic/gpu.ts`, `presets/presets.props.ts` and each new preset; remove "more presets" and "push variant" from Not yet.
- [ ] **Step 2: Changelogs:** one entry each in the existing style (English, Spanish): the new transitions by group, the shared options, and that zoom/spin/shake need the graphics card for their blur.
- [ ] **Step 3: Verify** `pnpm lint` PASS (Prettier on markdown).
- [ ] **Step 4: Commit** `docs(transition): presets, variants and GPU`. Stage only these three files — the changelogs may already hold unrelated unstaged `path` edits; if so, stage with `git add -p` only this entry's hunks.

### After the tasks

- Final whole-branch review (opus) against the spec and the Review Focus list.
- Live check by the owner in WebKitGTK and on Windows: each category's tiles, an export with a zoom and a luma fade.
