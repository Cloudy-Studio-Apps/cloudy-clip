# transition

Transitions between clips. A transition is a junction of the `transition` kind: it sits on the cut
between two adjacent clips of a video track, overlaps them (0.5 s by default) and mixes their
pictures with a preset (a look: dissolve, wipe, glitch…). This module holds the kind, the presets
point and the command to apply one. The 33 built-in tiles (20 presets and 13 variants) are in
`presets/`; the Transitions tab (`ui/`) lists them.

- **Tier:** feature
- **Requires:** `project`, `element`, `junction`, `timeline` (selection, `cutTarget`, `previewCut`), `inspector` (the
  `propertyControls` point, `FieldRow`, `FieldControlProps`)
- **Contributes:** the `transition` kind (to `junctionKinds`), the `transition-options` value type
  (to `propTypes`), the `transition-preset` and `transition-options` controls (to
  `propertyControls`), panel `transition.panel` (side, icon `Blend`), the command and tools below
- **Points it owns** (`transition.points.ts`): `transitionPresets` (id `transition.presets`, keyed
  by `id`), items made with `defineTransitionPreset`: `id`, `name`, `category`, `family?`,
  `properties` (the options), `defaults(format)`, `mix`, optional `thumbnail`. `variantOf(base, id,
name, overrides)` makes a variant of a preset.
- **API:** `TransitionApi` (`transition.options.ts`): `find(id)`, `list()`, `optionsSchema(preset)`.
- **Files:**
  - `transition.types.ts`: `TransitionPresetDefinition`, `TransitionProps`, `TransitionApi`, and the
    `transition-options` entry of `CustomProps`/`CustomValues`.
  - `transition.kind.ts`: the kind. Overlap: default 0.5 s, minimum one frame, maximum half the
    shorter clip. Values `{ preset, options }` (stored minimal). `normalize` fails with
    `transition.unknown_preset` for an unregistered preset, parses `options` with the preset's
    schema (`transition.invalid_options`), and drops the old options when the preset changes and the same change gives no
    `options` (it compares `env.previous.preset` with the new one, and checks `env.patch`). `mix` calls the preset with its resolved
    options; the chip shows the preset's `family`, else its name.
  - `transition.options.ts`: the `transition-options` prop type and the API.
  - `transition.apply.command.ts`: `transition.apply`.
  - `transition.mcp.ts`: the tools.
  - `presets/`: one file per routine, with its variants: `fade`, `crossDissolve`, `dissolve` (seeded
    block mask), `wipe`, `clock`, `iris` (circle), `split`, `push`, `slide`, `zoom`, `spin`, `shake`,
    `glare`, `blink`, `leak` (light leak), `woosh` (a whip pan squeezed and stretched through scratch
    canvases), `pixelate`, `luma` (luma fade, GPU), `ripple` (GPU), `glitch` (slice offsets and a
    red/blue split). `presets.ts` lists them all as `builtInPresets`, in tab order, contributed by the
    module. Masks are drawn into canvas `b` with `destination-in` (in place when `b` is a canvas, else
    into a temporary canvas); no pixel reads and no `ctx.filter`. Shared helpers:
    - `presets.props.ts`: the `ease`, `intensity` and `softness` options (`easeProp()`, `intensityProp()`,
      `softnessProp()`).
    - `presets.mask.ts`: `maskableSurface`, `revealThrough`, `drawDissolve`, `drawOnly`.
    - `presets.cache.ts`: scratch canvases per owner (`ghostCanvas`, `blurCanvas`, `dissolveCanvas`).
    - `presets.blur.ts`: `drawBlurred` (the GPU blur, with the 2D fallback through `withoutGpu`) and
      `drawStacked`.
    - `presets.camera.ts`: `drawMoved`, a picture scaled, turned and moved, with mirrored edges.
  - `logic/`: `easing.ts`, `noise.ts` (seeded random, block masks), `grid.ts` (the block grid of the
    dissolve), `color.ts`, `gpu.ts` (GPU passes for presets: zoom, spin and directional blur, luma
    key, ripple and mix; `drawGpu` draws a run over the canvas), `categories.ts` (the tab's sections),
    `options.ts` (`optionFields`, `optionsPatch`), `preview.ts` (`previewOnCut`).
  - `ui/`: `TransitionsPanel` (one section per category, ordered by `logic/categories.ts`),
    `PresetTile` (click: `transition.apply` on the selected junction, else the cut after the
    selected video clip, else a "Select a clip or a cut first" notice; press-and-drag through
    `preset.gesture.ts`: a DOM ghost that gives way, near a cut of a video track, to
    `timeline.previewCut` with what `logic/preview.ts` works out (`previewOnCut`: the duration,
    whether it fits, and how far each clip would move), `transition.apply { leftClipId, rightClipId }` on release over a cut,
    nothing elsewhere), `PresetThumbnail`, `thumbnail.hook.ts` and `thumbnail.draw.ts` (a canvas drawing the preset's
    `thumbnail ?? mix` over two token-colored sample pictures: a static frame at 0.5, and a
    `requestAnimationFrame` loop only while hovered; the hook's own picture canvases are redrawn
    every frame because mask presets draw into `b`). Sizes in `transition.layout.ts`.
  - `ui/controls.ts`, `TransitionPresetControl` (a select of the registered presets for the
    kind's `preset`, committed as `{ preset }`; the kind drops the old options) and
    `TransitionOptionsControl` (the chosen preset's options, drawn by the inspector control each
    spec names, found in `propertyControls`; every change is committed as the whole `{ options }`
    through the `live` it was given).
- **Applying:** drag a preset onto a cut, or click it to use the selected cut or junction, or the
  cut at the end of the selected clip. On a cut that already has a transition this replaces its
  preset and keeps the duration.
- **Silent:** transitions are picture only, like CapCut's. Sound on a cut would be its own junction
  kind.
- **Not yet:** a transition's own sound (that would be its own junction kind; see Silent).

## Presets

The tiles, in the order of `presets/presets.ts`. The Transitions tab groups them by category. A
variant's look is its base's look with the change named in it.

| Category | ID               | Name           | Look                                                                                      |
| -------- | ---------------- | -------------- | ----------------------------------------------------------------------------------------- |
| basic    | `fade`           | Fade           | a fades to a colour (black by default) at the cut, then b fades in                        |
| basic    | `dip-white`      | Dip to white   | Fade, through white                                                                       |
| basic    | `cross-dissolve` | Cross dissolve | a blends smoothly into b                                                                  |
| basic    | `dissolve`       | Dissolve       | b appears in random blocks; grain sets their size                                         |
| basic    | `wipe`           | Left to right  | b wipes in across the frame through a soft edge                                           |
| basic    | `wipe-down`      | Top to bottom  | Left to right, moving down                                                                |
| basic    | `clock`          | Clock wipe     | b is revealed by a hand sweeping round from 12 o'clock                                    |
| basic    | `iris-open`      | Circle open    | a circle grows from the centre and reveals b                                              |
| basic    | `iris-close`     | Circle close   | a circle shrinks over b and hides a                                                       |
| basic    | `split-h`        | Split          | barn doors: b opens from a centred band, or closes in from the edges                      |
| basic    | `split-v`        | Split vertical | Split, with the doors moving vertically                                                   |
| motion   | `push-left`      | Push left      | a and b slide across together, b arriving from the opposite edge; GPU motion blur         |
| motion   | `push-right`     | Push right     | Push left, moving right                                                                   |
| motion   | `push-up`        | Push up        | Push left, moving up                                                                      |
| motion   | `push-down`      | Push down      | Push left, moving down                                                                    |
| motion   | `slide-left`     | Slide left     | a stays still while b slides in over it                                                   |
| motion   | `slide-up`       | Slide up       | Slide left, moving up                                                                     |
| camera   | `zoom-in`        | Zoom in        | a pushes in to the centre, then b settles from the same scale; GPU radial blur at the cut |
| camera   | `zoom-out`       | Zoom out       | Zoom in, pulling out                                                                      |
| camera   | `spin`           | Spin           | a turns a quarter turn about the centre, then b turns back upright; GPU blur at the cut   |
| camera   | `spin-ccw`       | Spin left      | Spin, turning counter-clockwise                                                           |
| camera   | `shake`          | Shake          | the picture jolts in random jumps, blurred along the last one; GPU blur                   |
| light    | `glare`          | Glare          | a bright flash and a diagonal streak hide the cut                                         |
| light    | `blink`          | Blink          | two lids close over a and open on b                                                       |
| light    | `light-leak`     | Light leak     | a dissolves into b under drifting coloured glows that peak at the cut                     |
| light    | `film-burn`      | Film burn      | Light leak in orange, at full intensity                                                   |
| blur     | `woosh`          | Woosh          | a whip pan: the pair flies across fast, blurred along its travel                          |
| blur     | `woosh-up`       | Woosh up       | Woosh, moving up                                                                          |
| distort  | `pixelate`       | Pixelate       | a turns into big blocks, cuts to b at the middle, and b sharpens again                    |
| distort  | `luma-fade`      | Luma fade      | b appears through a's brightness, dark areas first; GPU, else a cross dissolve            |
| distort  | `ripple`         | Ripple         | rings bend both pictures while a dissolves into b; GPU, else a cross dissolve             |
| glitch   | `glitch`         | Glitch         | seeded horizontal slices shift, with a red/blue split at the cut                          |
| glitch   | `rgb-split`      | RGB split      | Glitch with no slices, only the colour split                                              |

### Variants and family

A routine that has variants names its `family` (Circle, Light leak, Push, Slide, Split, Spin,
Wipe, Zoom). Variants are made with `variantOf`: the base's options with the variant's overrides,
and the same `family`, so the chip names the routine ("Push") and not the direction. A preset with
no family gives its name to its variants (Fade, Woosh, Glitch). There are 13 variants: Dip to white,
Top to bottom, Circle close, Split vertical, Push right, Push up, Push down, Slide up, Zoom out,
Spin left, Film burn, Woosh up and RGB split.

### Shared options

Most presets take some of these, named the same way wherever they appear:

- **Ease** (`ease`): one of the keyframe ease presets, the shape of the progress. Presets read it
  with `eased`; a few ease presets overshoot, so the ones that need 0..1 clamp it.
- **Direction**: the way the motion goes (`left`, `right`, `up`, `down`, `in`/`out`, `cw`/`ccw`,
  `horizontal`/`vertical`, `dark`/`light`).
- **Intensity** (0..1): how strong the effect is (a blur, a jolt, a glow, a block size).
- **Softness** (0..1): how wide the feathered edge of a mask or wipe is.
- **Color**: the colour of a fade, glare or glow.

Dissolve has `grain`, glitch has `slices` and split has `mode` (open or close) on top of these.

### GPU

Zoom, spin, shake and push blur their motion on the GPU, and luma fade and ripple are drawn with GPU
passes (in `logic/gpu.ts`). A mix sees the GPU as `env.gpu` (`MixGpu`), and when it is absent calls
`env.withoutGpu()` and draws the plainer 2D look:

- **Live preview** without WebGL2: the plainer look is drawn (no blur; luma fade and ripple show a
  cross dissolve). The preview shows a notice once per session: "Some transitions need the graphics
  card; they show without blur for now."
- **Export and captures** without the GPU: the frame fails with `GpuUnavailable` and the export
  stops with an error. It never writes the plainer look, and the presets do not catch GPU errors.
- **Thumbnails** (the Transitions tab) have no GPU and always draw 2D, so their tiles show the plain
  look.

### Edges

Zoom, spin and shake move or turn the picture, which would leave its edges empty. `drawMoved`
(`presets.camera.ts`) fills them with mirrored tiles: the picture is drawn with its eight flipped
neighbours under the same transform, so the frame is always covered.

## Commands and tools

| Command / tool                          | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transition.apply` / `transition_apply` | Input `{ preset, options?, duration? }` and the cut: `junctionId`, or `clipId` (the cut after it), or `leftClipId` + `rightClipId`, or `trackId` + `at`. Adds a transition, or on a cut that has one changes its preset (old options dropped, duration kept unless given). One undo step. Returns the junction. Errors: `transition.unknown_preset`, `transition.invalid_options`, `junction.no_cut`, `junction.track_kind`, `junction.exists`, `junction.invalid_duration`, `junction.overlap`. |
| `transition_list_presets`               | Read-only: every preset's id, name, category, options JSON schema and defaults. Agents see all 33 tiles here, variants included.                                                                                                                                                                                                                                                                                                                                                                 |

Changing a transition's duration or options uses `junction.set` (`junction_set`).
