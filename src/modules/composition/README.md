# composition

What a timeline is. A composition is a size, a frame rate, a background, a length and its own tracks and clips; the timeline panel is a window on one of them. The data lives in `project`; this module owns the commands and tools that change it.

- **Tier:** core
- **Requires:** `project`, `element`, `media`, `timeline`
- **Contributes:** element `composition` (`composition.element.ts`: `picture: { fit: "contain", source: "composition" }`, sits on video and audio tracks); `librarySections` (`CompositionSection`), `timelineTabs` (`CompositionTabs`, `scopes: ["all", "sound"]`), `timelineOverlays` (`EmptyStart`, `EndMarker`), `timelineMenuItems` (Composition Settings, Extend to fit), `timelineDropHandlers` (`composition.drop.ts`), `clipActions` (double-click opens the original; right-click Group into composition, Make unique), `appOverlays` (`CompositionDialogHost`)
- **Points it owns:** —
- **API** (`CompositionApi`): `ui` (open dialog and selected tile, not in history), `openNew`, `openSettings(id)`, `closeDialog`, `select(id)`, `cancelWaiting`, `landPending`.
- **Files:**
  - `composition.commands.ts`: the list of commands below, from `composition.create.commands.ts`, `composition.settings.commands.ts`, `composition.library.commands.ts`, `composition.place.command.ts`, `composition.unique.command.ts`, `composition.group.command.ts`. `composition.guards.ts`: `checkFormat`, `checkLength` (`composition.too_short`), input schemas.
  - `composition.presets.ts`: `COMPOSITION_PRESETS`, `FPS_OPTIONS`.
  - `composition.drop.ts`: drops. A composition is placed, or just opens with nothing open. With nothing open, with compositions around, Main opens and the drop goes on; a video waits for its metadata outside the bus (`WaitingDrop`, Escape cancels), then runs `composition.createFromMedia`; audio and elements go through the dialog and land on confirm.
  - `composition.store.ts`: `createCompositionUi()`. `logic/timecode.ts`: `formatLength`, `parseLength` (`mm:ss:ff`).
  - `ui/`: `CompositionDialog` (New Composition and Composition Settings share one form), `CompositionTile`, `CompositionSection`, `CompositionTabs`, `EmptyStart`, `EndMarker` with `end.gesture.ts` (only its handle in the ruler takes the pointer: the line sits on the last clip's edge, where drops and trims aim; moves through the DOM, one `setSettings` on release).
  - `logic/group.ts`: `planGroup(state, clipIds)`, pure. `logic/resize.ts`: `scaleTransform(transform, fit, before, after)`, `scaleKeys(animation, fit, before, after)` (the same scaling for the keys of `transform.x`, `transform.y` and `transform.scale`; `setSettings` writes them with the static transform, also for a clip with no static one).
  - `logic/clone.ts`: `cloneComposition(draft, id, name)`: new ids, links remapped, placed compositions stay shared.
- **Grouping and keys:** `composition.group` cuts a neighbour left beside the placement (`trimToSpan`); when that cuts its start, the clip's `animationOrigin` moves with it so its keys stay on the picture, and its `sourceIn` moves by the file time the cut part played (`filePlayed`), so a sped-up or ramped clip stays in sync (a reversed one keeps its `sourceIn`, as a trim does).
- **Placements:** a clip with `compositionRef`, in a linked picture and sound pair (both always: placements are live). Trim is limited by the composition's length. `project`'s `settle` shortens placements when the original shrinks.

| Command                       | MCP tool                        | Notes                                                                                   |
| ----------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `composition.create`          | `composition_create`            | Creates the two tracks; the first composition becomes Main; opens it                    |
| `composition.createFromMedia` | `composition_create_from_media` | One undo step. Refuses `media.not_ready`, `composition.no_picture`                      |
| `composition.setSettings`     | `composition_set_settings`      | A `duration` alone turns Extend to fit off; `resize: "scale"` keeps clips in proportion |
| `composition.setMain`         | `composition_set_main`          |                                                                                         |
| `composition.duplicate`       | `composition_duplicate`         | Copies markers too. Compositions placed inside stay shared                              |
| `composition.delete`          | `composition_delete`            | Deletes its markers too. Refuses `composition.in_use`, `composition.main`               |
| `composition.extendToFit`     | `composition_extend_to_fit`     | One-time fit                                                                            |
| `composition.open`            | `composition_open`              | Not undoable. Sets the caller's own open composition, never the user's                  |
| `composition.closeTab`        | —                               | Not undoable. The user's tabs                                                           |
