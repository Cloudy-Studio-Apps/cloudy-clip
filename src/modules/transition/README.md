# transition

Transitions between clips. A transition is a junction of the `transition` kind: it sits on the cut
between two adjacent clips of a video track, overlaps them (0.5 s by default) and mixes their
pictures with a preset (a look: dissolve, wipe, glitch…). This module holds the kind, the presets
point and the command to apply one; the presets themselves and the Transitions tab come in later
changes.

- **Tier:** feature
- **Requires:** `project`, `element`, `junction`
- **Contributes:** the `transition` kind (to `junctionKinds`), the `transition-options` value type
  (to `propTypes`), the command and tools below
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
- **Not yet:** presets, the Transitions tab and its `transition-options` control.

## Commands and tools

| Command / tool                          | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transition.apply` / `transition_apply` | Input `{ preset, options?, duration? }` and the cut: `junctionId`, or `clipId` (the cut after it), or `leftClipId` + `rightClipId`, or `trackId` + `at`. Adds a transition, or on a cut that has one changes its preset (old options dropped, duration kept unless given). One undo step. Returns the junction. Errors: `transition.unknown_preset`, `transition.invalid_options`, `junction.no_cut`, `junction.track_kind`, `junction.exists`, `junction.invalid_duration`, `junction.overlap`. |
| `transition_list_presets`               | Read-only: every preset's id, name, category, options JSON schema and defaults.                                                                                                                                                                                                                                                                                                                                                                                                                  |

Changing a transition's duration or options uses `junction.set` (`junction_set`).
