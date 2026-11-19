# mask

Masks on picture clips and track mattes. A mask is a shape (rectangle, ellipse, star, heart, linear, mirror, or a drawn path) in the clip's picture that decides where it shows, feathered, grown or shrunk, combined with the other masks by mode. A track matte shows a clip only where another video track's picture is. Like After Effects' masks and track mattes.

- **Tier:** feature
- **Requires:** `project` (the document, `orderedMasks`, `animatedClip`, `writeKey`), `element` (which kinds draw a picture), `preview` (the actor's playhead, the default `at` of `mask_list`)
- **Contributes:** nothing yet (the key target, the Mask tab and the canvas overlay come in later changes)
- **Points it owns:** —
- **API** (`useModule(maskRef)`): `ui` (`MaskUiState`, per kernel, never in history: `selectedMaskId`, `selectedPointId`, `drawing`)
- **Files:**
  - `mask.commands.ts`: add, update, remove, reorder. `mask.matte.commands.ts`: `setMatte`. `mask.build.ts`: a new mask with the defaults. `mask.guards.ts`: `requirePictureClip`, `requireMask`, `checkRange`. `mask.schema.ts`: the Zod inputs.
  - `mask.mcp.ts`: the tools, and `mask_list`. `mask.store.ts`: `createMaskUi()`.
- **Data:** `clip.masks`, `clip.maskOrder` and `clip.matte` live in the document (`project` declares and validates them, see its README). Mask space is output px from the picture's center, the picture fitted in the frame before the clip's transform. Key paths: `masks.<id>.opacity | feather | expansion | x | y | rotation` and `masks.<id>.shape.width | height | roundness | points | inner | scale`.
- **Invariants:** only picture clips on video tracks have masks or a matte. Removing a mask drops its keys; removing the last drops `masks` and `maskOrder`. A matte names another video track of the clip's composition; a matte track has no matte of its own, and a clip on a matte track has none (`mask.matte_chain`). Every command is one undo step.
- **Not yet:** the key target and editing a path's points, the Mask tab, the canvas overlay, the engine.

| Command         | MCP tool         | Notes                                                                                                                                                                                                    |
| --------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mask.add`      | `mask_add`       | `clipIds`, exactly one of `preset` or `points` (3+), `values`, `mode`, `name` (default `Mask N`). Sizes default to half the frame. `clip_not_found`, `not_picture`, `invalid`. Returns `maskIds` by clip |
| `mask.update`   | `mask_update`    | `clipId`, `maskId`, `patch` (any field but `id` and the points; numbers of `shape`), `at` for keyed fields (a key is written there). `clip_not_found`, `not_found`, `invalid`, `animated`                |
| `mask.remove`   | `mask_remove`    | `clipId`, `maskIds` (empty: all) with their keys. `clip_not_found`, `not_found`                                                                                                                          |
| `mask.reorder`  | `mask_reorder`   | `clipId`, `maskId`, `index`. `not_found`, `invalid`                                                                                                                                                      |
| `mask.setMatte` | `mask_set_matte` | `clipIds`, `trackId` or `null`, `by` (`alpha` default, `luma`), `invert`. `track_not_found`, `not_video`, `own_track`, `matte_chain`                                                                     |
| (read)          | `mask_list`      | `{ masks, matte }`: masks in order with their values at `at` (default your playhead), path points as `{ id, x, y, inX, inY, outX, outY }`                                                                |
