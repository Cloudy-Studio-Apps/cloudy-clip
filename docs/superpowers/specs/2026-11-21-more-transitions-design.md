# More transitions — design

Date: 2026-11-21. Module: `transition` (feature), with small changes in `junction` (core) and `preview` (core).

## Intent

Cloudy Clip ships 7 transition presets. Editors coming from CapCut, Premiere, DaVinci Resolve and
After Effects expect the transitions they use every day to be there, ready to drop on a cut, and
then adjustable. This adds the commonly used ones as prebuilt tiles (one click or drag, like CapCut)
whose options stay editable in the inspector (customizable, like Premiere/Resolve).

Research (no source publishes real usage numbers; this is the overlap of CapCut's own trend pages,
Premiere/Resolve built-in bins and After Effects preset packs): cross dissolve and fades are the
staples; then push/slide, zoom, spin, whip, iris and clock wipes, flashes and light leaks, glitch.

## Goals

- 33 tiles in the Transitions tab (26 new), built from 13 new drawing routines plus the 7 that exist.
- Every new preset has the shared options that make sense for it: `ease`, `direction`, `intensity`,
  `color` (and `softness` where an edge exists).
- Zoom, spin and shake get real motion blur (radial / rotational / directional). That needs the GPU
  inside a transition, which doesn't exist yet: this is the one system change.
- Agents see every new preset through `transition_list_presets` and apply it with `transition_apply`,
  with no new tools.

## Non-goals

- User-saved presets ("my tuned zoom"). Asked, unanswered; left out (my call). It needs a home
  (app settings vs. the project) and its own design.
- Adjustment layers / layer effects. A transition already gets each clip fully drawn into its own
  full-frame canvas (`engine.mix.ts`), so it doesn't need them.
- Smooth Cut / morph (optical flow), page peel, 3D cube/flip with lighting, bundled overlay videos
  (light leaks are generated in code), sound on a cut.
- Velocity edits and beat-sync: called "transitions" in CapCut articles but they are speed ramps and
  markers, which exist.

## Anti-goals

- A preset that looks fine in the preview and different in the export.
- A GPU failure that silently exports a wrong picture.
- Per-frame allocations or React state in a mix (rule 24, Scratch canvases per owner as today).

## Constraints (from the code)

- Mixes draw with Canvas 2D: no `ctx.filter` (WebKitGTK), no `getImageData`. Blur in 2D exists only
  as Woosh's squeeze-and-stretch, which works along one axis.
- `MixFn(ctx, a, b, progress, props, env)`; `a`/`b` are full-frame canvases; `env` has `format`,
  `kx`, `ky`, `random`, `elapsed` (`junction.types.ts`).
- The WebGL2 runner (`preview/gpu/gpu.runner.ts`, `GpuRunner.run(source, size, passes)`) is owned by
  each engine (`EngineOptions.gpu`), takes one source picture (`inputs: -1` is it, `n` is pass `n`).
  It is the only owner of WebGL in the app.
- Layering: `junction` (core) can't import `preview`; `preview` requires `junction`. So the type the
  mix sees must live in `junction` or below; `preview` passes its runner in.
- Masks set the rule for GPU failure: live preview degrades, capture/export throws
  (`filterTarget !== "preview"`).
- Thumbnails (`ui/thumbnail.draw.ts`) draw `thumbnail ?? mix` over two sample pictures outside any
  engine, with no GPU.

## Approaches considered

1. **GPU in `MixEnv` + 2D presets (picked).** Add an optional `env.gpu` the mix can use for blur and
   warps; every preset still has a plain 2D path used when `env.gpu` is missing (thumbnails, no
   WebGL2). Variants are separate presets sharing one routine with different defaults.
   Trade-off: one small core change; zoom/spin look right everywhere the GPU works.
2. **2D only.** Zoom and spin without real blur (stacked semi-transparent copies). No core change,
   but the CapCut "punch" look comes from the blur; stacked copies look like ghosting and cost more
   draws per frame than one shader.
3. **A GPU renderer for all transitions** (the README's "Not yet"). Cleanest long-term, but rewrites
   the 7 existing presets and the thumbnail path for no visible gain now.

## Design

### 1. GPU inside a mix (`junction`, `preview`)

- `junction.types.ts`: `MixEnv.gpu?: MixGpu`, where
  `MixGpu.run(sources: readonly CanvasImageSource[], passes: readonly GpuPass[]): CanvasImageSource`
  runs at the canvas size and returns a picture to `drawImage` before the next call.
- `GpuPass` / `GpuUniform` / `GpuTexture` / `GpuInt` types move down into `junction` (or whichever
  lower module the builder finds fits better; one definition, `preview` re-exports or imports it —
  never two copies). Pass `inputs`: `-1` is source 0, `-2` is source 1, `n` is pass `n`.
- `GpuRunner.run` accepts one source or several (the same uploading code, per source). `-1` stays
  the first source, so existing filter and mask passes are unchanged. It still returns the runner's
  one shared canvas: the caller draws it before the next `run` (same contract as masks and
  filters). A preset should chain its passes and take both sources in one `run` where it can.
- `engine.mix.ts` builds `env.gpu` from the engine's runner, following the masks rule (my call):
  - **Live preview:** `env.gpu` is there only when the runner is `available`. Without it, ★ presets
    take their 2D path, which may look plainer (no blur). The user is told once per kernel with
    `notify` (the same as `maskFailed`).
  - **Capture / export** (`filterTarget !== "preview"`): `env.gpu` is always there when the
    engine has a runner, so a missing GPU throws `GpuUnavailable` from `run`. A mix that throws
    `GpuUnavailable` is rethrown and the export fails with a message, so it never silently
    exports the 2D look. Other mix errors keep today's "right over left" fallback.
- Helper for presets (in `transition`, not core): `logic/gpu.ts` with the shaders: `zoomBlur`
  (radial, center + strength), `spinBlur` (rotational, angle), `directionalBlur` (angle, length),
  `lumaKey` (B through A's luma), `ripple`. Sample counts fixed (e.g. 16), so cost is one draw per pass.

### 2. Shared options (`transition/logic/`)

- `ease`: an enum of `EASE_PRESETS` from `project` (the same curves keyframes use; `easeProgress`
  applies one). Default per preset. Every preset gets it where motion has a curve, existing ones
  included.
- **No legacy support** (owner's rule): existing presets' ids, options and looks may change
  freely to fit the shared options; old saved projects need not reopen unchanged, and nothing is
  migrated.
- `direction`: one key, with each preset's own enum: `left | right | up | down`, `in | out`,
  `cw | ccw`, and so on. Wipe already has the four directions. Woosh's `left | right` gains
  `up | down`.
- `intensity`: 0..1 slider, the preset's "how much" (blur, shake, glow).
- `color`, `softness`: as Fade and Wipe already have.

### 3. Variants as tiles

A variant is another preset object: `{ ...zoomPreset, id: "zoom-out", name: "Zoom out", defaults }`.
Every option stays editable on a
variant. So that "Push left" changed to `up` isn't mislabeled, a preset gets an optional `family`
name ("Push"). The timeline chip shows `family ?? name`, and the tile shows `name` (my call; one
optional field on `TransitionPresetDefinition`, nothing else changes in the point).

### 4. The presets

`★` = uses `env.gpu` when present, 2D path otherwise. Categories gain `motion`, `camera`, `light`,
`distort`; `logic/categories.ts` orders them: basic, motion, camera, light, blur, distort, glitch,
overlay.

| Category | Routine (file)                      | Tiles (id → name)                                   | Options                                     | Look                                                      |
| -------- | ----------------------------------- | --------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| basic    | `crossDissolve`, `dissolve` (exist) | `cross-dissolve`, `dissolve` (unchanged)            | (existing)                                  | blend / grain                                             |
| basic    | `fade` (exists)                     | `fade` Fade · `dip-white` Dip to white              | color                                       | A to color to B                                           |
| basic    | `wipe` (exists)                     | `wipe` Left to right · `wipe-down` Top to bottom    | direction, softness                         | soft edge                                                 |
| basic    | `iris.ts`                           | `iris-open` Circle open · `iris-close` Circle close | direction in/out, softness, ease            | circle mask grows / shrinks                               |
| basic    | `clock.ts`                          | `clock` Clock wipe                                  | direction cw/ccw, softness, ease            | sweeping hand                                             |
| basic    | `split.ts`                          | `split-h` Split · `split-v` Split vertical          | direction (h/v, open/close), softness, ease | barn doors                                                |
| motion   | `push.ts`                           | `push-left`, `push-right`, `push-up`, `push-down`   | direction, ease, intensity (motion blur ★)  | B pushes A out                                            |
| motion   | `slide.ts`                          | `slide-left`, `slide-up`                            | direction, ease                             | B slides over a still A                                   |
| camera   | `zoom.ts` ★                         | `zoom-in` Zoom in · `zoom-out` Zoom out             | direction in/out, intensity, ease           | punch through with radial blur, cut at peak               |
| camera   | `spin.ts` ★                         | `spin` Spin · `spin-ccw` Spin left                  | direction cw/ccw, intensity, ease           | rotate + slight zoom, rotational blur                     |
| camera   | `shake.ts` ★                        | `shake` Shake                                       | intensity                                   | seeded jitter with directional blur                       |
| blur     | `woosh` (exists)                    | `woosh` · `woosh-up` Woosh up                       | direction (+ up/down)                       | whip pan                                                  |
| light    | `glare` (exists)                    | `glare` Glare (CapCut "Flash")                      | color                                       | flash hides the cut                                       |
| light    | `leak.ts`                           | `light-leak` Light leak · `film-burn` Film burn     | color, intensity                            | moving warm gradient blobs added with `lighter`           |
| light    | `blink.ts`                          | `blink` Blink                                       | color, ease                                 | eyelids close on A, open on B                             |
| distort  | `pixelate.ts`                       | `pixelate` Pixelate                                 | intensity                                   | blocks grow then shrink (smoothing off, no pixel reads)   |
| distort  | `luma.ts` ★                         | `luma-fade` Luma fade                               | direction dark→light / light→dark, softness | B appears through A's brightness; 2D path: cross dissolve |
| distort  | `ripple.ts` ★                       | `ripple` Ripple                                     | intensity                                   | wave warp; 2D path: cross dissolve with a slight scale    |
| glitch   | `glitch` (exists)                   | `glitch` · `rgb-split` RGB split                    | (existing) + slices off                     | channel split only                                        |

Count: 13 new routines (iris, clock, split, push, slide, zoom, spin, shake, leak, blink, pixelate,
luma, ripple). 33 tiles: the 7 existing plus 26 new.

### 5. Thumbnails

Thumbnails keep drawing without a GPU, so ★ presets show their 2D path there. If one looks too
plain (a zoom with no blur), the preset gives a `thumbnail` override, which is already supported.
For example, a few stacked faded copies can suggest the blur. Which ★ presets need one is the
builder's call.

### 6. Docs

`transition/README.md` (presets table, options, the `env.gpu` paragraph), `junction/README.md`
(`MixEnv.gpu`, the export rule), `preview/README.md` (two-source runs, `env.gpu`), both changelogs.

## Left to the builder

- Exact curves, default durations per routine, sample counts and shader math.
- Where the GPU types end up (junction or another lower module), as long as there's one definition.
- Whether existing routines (`wipe`, `woosh`, `glitch`) take the new options by extension or the
  variants only change their defaults.
- Tests: per CLAUDE.md rule 3 the presets get none. If the two-source runner change breaks an
  existing preview test, fix that test; no new ones unless something only a test would catch.
