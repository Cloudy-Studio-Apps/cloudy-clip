# solid

Flat colours and gradients. A solid sits in the media library like a file, with its own smart bin, and dragging one onto a timeline makes a clip of five seconds.

- **Tier:** feature
- **Requires:** `project`, `element`, `media`, `transform`
- **Contributes:** `elements` (`solid`), `libraryKinds` (`solid`: smart bin "Solid colors", `SolidTile`, `SolidButton`)
- **Points it owns:** —
- **API:** none
- **Files:**
  - `solid.element.ts`: the element: a fill (`fillType`: a `color` or a `gradient`), a size, and the transform and composite groups. Its size defaults to the format, and `clip.props` keeps only what differs, so a clip that stores no size follows its composition (`picture.followsFrame`). The row's reset goes back to that. Sizes can't be keyed.
  - `solid.commands.ts`: the commands below. Library solids live in the document (`ProjectState.solids`).
  - `ui/`: `SolidTile`, `SolidButton`, `SolidDialog`, `useSolidEntries`.
- **Invariants:** a clip holds its own copy of the colour, so changing or removing a library solid never touches clips.

| Command        | MCP tool       | Notes                                      |
| -------------- | -------------- | ------------------------------------------ |
| `solid.create` | `solid_create` | In `binId` or Master. `media.no_bin`       |
| `solid.update` | `solid_update` | `binId: null` is Master. `solid.not_found` |
| `solid.remove` | `solid_remove` | Clips keep their colour. `solid.not_found` |
