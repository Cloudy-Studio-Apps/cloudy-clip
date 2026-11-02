# keyframe

Keys on a clip's values over time: add a key, move keys together, change their values, remove them, clear a field. The keys themselves are `Clip.animation` in `project` (read by the preview and export as data); this module owns the edit commands and tools. Its panel and canvas parts come in later tasks.

- **Tier:** feature
- **Requires:** `project`, `element`
- **Contributes:** key target `element` (`keyTargets`): every number, color, enum and boolean field of a clip's element, from `element`'s `keyableFields`
- **Points it owns:** `keyTargets` (this module for the element's fields; a module that keys values of its own, like speed, adds a target)
- **API** (`useModule(keyframeRef)` / `ctx.require(keyframeRef)`): `fieldsOf(clip)`, `fieldOf(clip, path)`, `view` (the panel's state: mode, scope, selection, ... per kernel, never in history)
- **Files:**
  - `keyframe.fields.ts`: the element target and the API. `keyframe.guards.ts`: `requireKey`, `requireClip`, `requireField`, `checkKeyValue`, the Zod schemas.
  - `keyframe.edit.commands.ts`: set, remove, move, setValues. `keyframe.commands.ts`: clear and the list. `keyframe.write.ts`: writes the tracks of a command in one `ctx.mutate`, then the static values and the targets' `afterWrite`.
  - `keyframe.view.store.ts`: the view store, and `pruneSelection`, which the module runs on every project change so the selection forgets keys that an undo or an agent removed.
- **Invariants:** a track never has zero keys: when the last key goes the track goes and its value becomes the static value (`KeyField.commitStatic`, run in the same command, so one undo step). A command validates every key and value before it writes, so one key that is gone (`keyframe.not_found`) changes nothing. `at` and `delta` are timeline times; stored key times are content times (`contentTime`, `timeOfContent`). A key set outside the clip lands on its nearest frame. A new track copies `blend`, `shared`, `min` and `max` from its field.
- **Not yet:** ease, smooth and loop commands, the panel, the diamonds in the inspector.

| Command              | MCP tool              | Notes                                                                                                                                             |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyframe.set`       | `keyframe_set`        | Adds or updates the key on that frame; `value` defaults to the value there. `clip_not_found`, `not_keyable`, `invalid_value`. Returns `key`       |
| `keyframe.remove`    | `keyframe_remove`     | The last key of a field leaves its value as the static value. `not_found`                                                                         |
| `keyframe.move`      | `keyframe_move`       | Keys move together by `delta`, so moved keys never land on each other; one that lands on an unmoved key replaces it. `not_found`, `invalid_value` |
| `keyframe.setValues` | `keyframe_set_values` | A `value`, or an `offset` clamped to the field's range. `not_found`, `invalid_value`                                                              |
| `keyframe.clear`     | `keyframe_clear`      | Removes tracks; the value at `at` becomes the static value. `clip_not_found`, `not_keyable`                                                       |
