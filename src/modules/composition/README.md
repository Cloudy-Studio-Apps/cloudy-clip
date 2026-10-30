# composition

What a timeline is. A composition is a size, a frame rate, a background, a length and its own tracks and clips; the timeline panel is a window on one of them. The data lives in `project`; this module owns the commands and tools that change it.

- **Tier:** core
- **Requires:** `project`, `media`, `timeline`
- **Contributes:** `librarySections` (`CompositionSection`), `timelineTabs` (`CompositionTabs`), `timelineOverlays` (`EmptyStart`, `EndMarker`), `timelineMenuItems` (Composition Settings, Extend to fit), `appOverlays` (`CompositionDialogHost`)
- **Points it owns:** —
- **API** (`CompositionApi`): `ui` (open dialog and selected tile, not in history), `openNew`, `openSettings(id)`, `closeDialog`, `select(id)`.
- **Files:**
  - `composition.commands.ts`: the commands below. `composition.guards.ts`: `requireComposition`, `checkFormat`, `formatInput`.
  - `composition.presets.ts`: `COMPOSITION_PRESETS`, `FPS_OPTIONS`.
  - `composition.store.ts`: `createCompositionUi()`. `logic/timecode.ts`: `formatLength`, `parseLength` (`mm:ss:ff`).
  - `ui/`: `CompositionDialog` (New Composition and Composition Settings share one form), `CompositionTile`, `CompositionSection`, `CompositionTabs`, `EmptyStart`, `EndMarker` with `end.gesture.ts` (moves through the DOM, one `setSettings` on release).
  - `logic/clone.ts`: `cloneComposition(draft, id, name)`: new ids, links remapped, placed compositions stay shared.
- **Not yet:** placing.

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
