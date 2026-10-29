# transition

Transitions between clips. A transition is a junction of the `transition` kind: it sits on the cut
between two adjacent clips of a video track, overlaps them (0.5 s by default) and mixes their
pictures with a preset (a look: dissolve, wipe, glitch…). This module holds the kind, the presets
point and the command to apply one; the seven built-in presets are in `presets/`; the Transitions tab (`ui/`)
lists them.

- **Tier:** feature
- **Requires:** `project`, `element`, `junction`, `timeline` (selection, `cutTarget`, `highlightCut`), `inspector` (the
  `propertyControls` point, `FieldRow`, `FieldControlProps`)
- **Contributes:** the `transition` kind (to `junctionKinds`), the `transition-options` value type
  (to `propTypes`), the `transition-preset` and `transition-options` controls (to
  `propertyControls`), panel `transition.panel` (side, icon `Blend`), the command and tools below
- **Points it owns** (`transition.points.ts`): `transitionPresets` (id `transition.presets`, keyed
  by `id`), items made with `defineTransitionPreset`: `id`, `name`, `category`, `properties` (the
  options), `defaults(format)`, `mix`, optional `thumbnail`.
- **API:** `TransitionApi` (`transition.options.ts`): `find(id)`, `list()`, `optionsSchema(preset)`.
- **Files:**
  - `transition.types.ts`: `TransitionPresetDefinition`, `TransitionProps`, `TransitionApi`, and the
    `transition-options` entry of `CustomProps`/`CustomValues`.
  - `transition.kind.ts`: the kind. Overlap: default 0.5 s, minimum one frame, maximum half the
    shorter clip. Values `{ preset, options }` (stored minimal). `normalize` fails with
    `transition.unknown_preset` for an unregistered preset, parses `options` with the preset's
    schema (`transition.invalid_options`), and drops the old options when the preset changes (it
    compares `env.previous.preset` with the new one). `mix` calls the preset with its resolved
    options; the chip shows the preset's name.
  - `transition.options.ts`: the `transition-options` prop type and the API.
  - `transition.apply.command.ts`: `transition.apply`.
  - `transition.mcp.ts`: the tools.
  - `presets/`: `fade`, `cross-dissolve`, `dissolve` (seeded block mask), `wipe` (gradient mask),
    `glare`, `woosh` (4-pass offset smear), `glitch` (slice offsets + red/blue split); `presets.ts`
    lists them as `builtInPresets`, contributed by the module. Masks are drawn into canvas `b`
    with `destination-in` (in place when `b` is a canvas, else into a temporary canvas); no pixel
    reads and no `ctx.filter`.
  - `logic/`: `easing.ts`, `noise.ts` (seeded random, block masks), `color.ts`.
  - `ui/`: `TransitionsPanel` (one section per category, ordered by `logic/categories.ts`),
    `PresetTile` (click: `transition.apply` on the selected junction, else the cut after the
    selected video clip, else a "Select a clip or a cut first" notice; press-and-drag through
    `preset.gesture.ts`: a DOM ghost, the cut under the pointer highlighted with
    `timeline.highlightCut`, `transition.apply { leftClipId, rightClipId }` on release over a cut,
    nothing elsewhere), `PresetThumbnail`, `thumbnail.hook.ts` and `thumbnail.draw.ts` (a canvas drawing the preset's
    `thumbnail ?? mix` over two token-colored sample pictures: a static frame at 0.5, and a
    `requestAnimationFrame` loop only while hovered; the hook's own picture canvases are redrawn
    every frame because mask presets draw into `b`). Sizes in `transition.layout.ts`.
  - `ui/controls.ts`, `TransitionPresetControl` (a select of the registered presets for the
    kind's `preset`, committed as `{ preset }`; the kind drops the old options) and
    `TransitionOptionsControl` (the chosen preset's options, drawn by the inspector control each
    spec names, found in `propertyControls`; every change is committed as the whole `{ options }`
    through the `live` it was given). `logic/options.ts`: `optionFields`, `optionsPatch`.

## Commands and tools

| Command / tool                          | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transition.apply` / `transition_apply` | Input `{ preset, options?, duration? }` and the cut: `junctionId`, or `clipId` (the cut after it), or `leftClipId` + `rightClipId`, or `trackId` + `at`. Adds a transition, or on a cut that has one changes its preset (old options dropped, duration kept unless given). One undo step. Returns the junction. Errors: `transition.unknown_preset`, `transition.invalid_options`, `junction.no_cut`, `junction.track_kind`, `junction.exists`, `junction.invalid_duration`, `junction.overlap`. |
| `transition_list_presets`               | Read-only: every preset's id, name, category, options JSON schema and defaults.                                                                                                                                                                                                                                                                                                                                                                                                                  |

Changing a transition's duration or options uses `junction.set` (`junction_set`).
