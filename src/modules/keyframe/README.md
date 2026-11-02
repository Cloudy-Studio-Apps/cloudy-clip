# keyframe

Keys on a clip's values over time: add a key, move keys together, change their values, remove them, clear a field. The keys themselves are `Clip.animation` in `project` (read by the preview and export as data); this module owns the edit commands and tools. The inspector's diamonds are here; its panel and canvas parts come later.

- **Tier:** feature
- **Requires:** `project`, `element`, `preview` (the playhead, `preview.seek`), `inspector` (`fieldActions`)
- **Contributes:** field action `keyframe.key` (`fieldActions`, order 10, for every keyable field), key target `element` (`keyTargets`): every number, color, enum and boolean field of a clip's element, from `element`'s `keyableFields`
- **Points it owns:** `keyTargets` (this module for the element's fields; a module that keys values of its own, like speed, adds a target)
- **API** (`useModule(keyframeRef)` / `ctx.require(keyframeRef)`): `fieldsOf(clip)`, `fieldOf(clip, path)`, `clipboard` (what each actor copied, per kernel, never in history), `view` (the panel's state: mode, scope, selection, ... per kernel, never in history)
- **Files:**
  - `keyframe.fields.ts`: the element target and the API. `keyframe.guards.ts`: `requireKey`, `requireClip`, `requireField`, `checkKeyValue`, the Zod schemas.
  - `keyframe.ease.commands.ts`: setEase, setAfter, scale. `keyframe.clipboard.commands.ts`: copy, paste.
  - `keyframe.edit.commands.ts`: set, remove, move, setValues. `keyframe.commands.ts`: clear and the list. `keyframe.write.ts`: writes the tracks of a command in one `ctx.mutate`, then the static values and the targets' `afterWrite`.
  - `keyframe.view.store.ts`: the view store, and `pruneSelection`, which the module runs on every project change so the selection forgets keys that an undo or an agent removed.
- **Invariants:** a track never has zero keys: when the last key goes the track goes and its value becomes the static value (`KeyField.commitStatic`, run in the same command, so one undo step). A command validates every key and value before it writes, so one key that is gone (`keyframe.not_found`) changes nothing. `at` and `delta` are timeline times; stored key times are content times (`contentTime`, `timeOfContent`). A key set outside the clip lands on its nearest frame. A new track copies `blend`, `shared`, `min` and `max` from its field.
- **Clipboard:** copied keys store content-time offsets from the earliest key, with value, ease and smooth. A paste puts the earliest at `at` and keeps the spacing on the target clip's own clock, with fresh ids; paths the clip can't key are skipped.
- **Diamonds** (`ui/KeyAction.tsx`): a previous arrow, a diamond and a next arrow at the end of a row, for the row's paths that the clip can key (Position keys X and Y, a color its opacity). The diamond adds keys at the playhead (`keyframe.set`, one per path) or removes the ones there (`keyframe.remove`, one step); the arrows `preview.seek` to the nearest key time of any of the paths. It subscribes to `playback.onTime` and sets `data-state` on itself and `data-key-state` on the row (no React state), which colors the diamond and the value.
- **Not yet:** the panel.

| Command              | MCP tool              | Notes                                                                                                                                             |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyframe.set`       | `keyframe_set`        | Adds or updates the key on that frame; `value` defaults to the value there. `clip_not_found`, `not_keyable`, `invalid_value`. Returns `key`       |
| `keyframe.remove`    | `keyframe_remove`     | The last key of a field leaves its value as the static value. `not_found`                                                                         |
| `keyframe.move`      | `keyframe_move`       | Keys move together by `delta`, so moved keys never land on each other; one that lands on an unmoved key replaces it. `not_found`, `invalid_value` |
| `keyframe.setValues` | `keyframe_set_values` | A `value`, or an `offset` clamped to the field's range. `not_found`, `invalid_value`                                                              |
| `keyframe.clear`     | `keyframe_clear`      | Removes tracks; the value at `at` becomes the static value. `clip_not_found`, `not_keyable`                                                       |
| `keyframe.setEase`   | `keyframe_set_ease`   | Per key `ease` (preset name or ease object) and/or `smooth`. `not_found`, `invalid_value`                                                         |
| `keyframe.setAfter`  | `keyframe_set_after`  | `hold` / `loop` / `pingpong` after the last key. `not_found`, `no_loop` (speed)                                                                   |
| `keyframe.scale`     | `keyframe_scale`      | Distance from `pivot` times `factor` (not 0), rounded. A negative factor flips the keys and mirrors the curves. `not_found`, `invalid_value`      |
| `keyframe.copy`      | `keyframe_copy`       | Not undoable; to your own clipboard. `not_found`                                                                                                  |
| `keyframe.paste`     | `keyframe_paste`      | Earliest copied key at `at`, onto each clip's matching fields. `clipboard_empty`, `clip_not_found`, `no_target`                                   |
| (read)               | `keyframe_sample`     | `{ time, value }[]` of a field from `from` to `to` by `step`, at most 1000. Works without keys                                                    |
| (read)               | `keyframe_list_eases` | The ease presets, in order                                                                                                                        |
