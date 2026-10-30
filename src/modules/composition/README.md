# composition

What a timeline is. A composition is a size, a frame rate, a background, a length and its own tracks and clips; the timeline panel is a window on one of them. The data lives in `project`; this module owns the commands and tools that change it.

- **Tier:** core
- **Requires:** `project`
- **Contributes:** —
- **Points it owns:** —
- **API:** none yet.
- **Files:**
  - `composition.commands.ts`: the commands below. `composition.guards.ts`: `requireComposition`, `checkFormat`, `formatInput`.
  - `composition.presets.ts`: `COMPOSITION_PRESETS`, `FPS_OPTIONS`.
  - `logic/clone.ts`: `cloneComposition(draft, id, name)`: new ids, links remapped, placed compositions stay shared.
- **Not yet:** the dialog, the Library section, tabs, placing.

| Command                   | MCP tool                    | Notes                                                                  |
| ------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| `composition.create`      | `composition_create`        | Creates the two tracks; the first composition becomes Main; opens it   |
| `composition.setSettings` | `composition_set_settings`  | A `duration` alone turns Extend to fit off                             |
| `composition.setMain`     | `composition_set_main`      |                                                                        |
| `composition.duplicate`   | `composition_duplicate`     | Compositions placed inside stay shared                                 |
| `composition.delete`      | `composition_delete`        | Refuses `composition.in_use`, `composition.main`                       |
| `composition.extendToFit` | `composition_extend_to_fit` | One-time fit                                                           |
| `composition.open`        | `composition_open`          | Not undoable. Sets the caller's own open composition, never the user's |
| `composition.closeTab`    | —                           | Not undoable. The user's tabs                                          |
