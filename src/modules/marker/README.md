# marker

Bookmarks on a composition's timeline: small colored flags in the ruler, each with an optional note. Press M to drop one at the playhead (also while playing), Shift+M and Ctrl+Shift+M to jump to the next and previous one. Clips, trims and the ruler scrub snap to them, so cuts land on a beat tapped in while the music plays. Agents read and write the same markers: a note like "make this punchier" tells an agent what to do where, and an agent can leave markers for the user to review.

- **Tier:** feature
- **Requires:** `project`, `timeline`, `preview`
- **Contributes:** keybindings `marker.add` (M), `marker.next` (Shift+M), `marker.previous` (Ctrl/Cmd+Shift+M); `timelineSnapTargets` `marker.times`; `timelineOverlays` `marker.flags` (scopes `["all", "sound"]`: a marker dropped with M on the Sound page shows there too); `timelineMenuItems` `marker.menu` (Add marker here, where you right-clicked a lane; Add marker at playhead); `clipActions` `marker.clipMenu` (Add marker at playhead, in the timing group)
- **Points it owns:** —
- **API** (`useModule(markerRef)`): `ui`, the view state: `lastColor` (what a new marker takes) and `editing` (the marker whose editor is open)
- **Files:**
  - `marker.commands.ts`: the commands below. Markers live in the document (`ProjectState.markers`, one record each, so the user's and an agent's markers undo on their own). `project` declares the type and validates that a marker's composition exists; `composition` deletes and copies a composition's markers with it.
  - `marker.menu.ts`: the right-click entries of the timeline and of clips.
  - `marker.keys.ts`: the keybindings. The jumps resolve to `preview.seek`.
  - `logic/markers.ts`: the colors' hex values (fixed: a marker's color is the user's label, not chrome), next/previous, frame flooring.
  - `ui/`: `MarkerFlags` (the overlay), `MarkerFlag` (one flag: click seeks, drag moves, double-click edits, right-click removes), `flag.gesture.ts`, `MarkerEditor` (note and color).
- **Invariants:** a marker added at the playhead lands on the start of the frame the playhead shows. A marker may sit past the composition's end; it is kept and drawn. Markers stay put when clips ripple. Two markers may share a time; next/previous step past it.
- **Not yet:** range markers, markers on clips or media, a marker list, exporting markers as chapters.

| Command         | MCP tool        | Notes                                                                                            |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `marker.add`    | `marker_add`    | Defaults: your open composition, your playhead, empty note, blue. `marker.composition_not_found` |
| `marker.update` | `marker_update` | Time, note or color; at least one. `marker.not_found`, `marker.nothing`                          |
| `marker.remove` | `marker_remove` | Many ids in one step; all or none. `marker.not_found`                                            |
| —               | `marker_list`   | Markers of a composition (yours open by default), by time: `{ id, time, note, color }`           |
