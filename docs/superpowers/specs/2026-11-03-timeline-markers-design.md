# Timeline markers

## Intent

A marker is a bookmark at one moment of a composition: a colored flag in the ruler with an optional
note. The user cares most about three things, in their words: productivity, professional editing, and
working easily with agents. Markers serve all three:

- **Productivity:** drop flags while watching (even during playback), then jump between them instead
  of scrubbing.
- **Professional editing:** clips, trims and the playhead snap to markers, so cuts land exactly on a
  beat or a cue tapped in while the music plays.
- **Agents:** markers are a shared way to point at a moment. The user leaves "make this punchier" and
  asks the agent to handle every marker. The agent leaves "awkward pause here" for the user to review.

## Goals

1. Press **M** to add a marker at the playhead, also while playing (one marker per press, at the
   exact playhead time).
2. Markers show as small colored flags in the ruler of the open composition. Hover shows the note.
3. Clips (move), trims and the dragged ruler playhead snap to markers, like they snap to clip edges.
4. Jump to the next marker with **Shift+M**, to the previous with **Ctrl+Shift+M** (Cmd on macOS),
   following Premiere's keys.
5. Drag a flag to move it (snapping to frames like the rest of the timeline). Double-click it to edit
   the note and color. Right-click it to delete it.
6. Markers are part of the project: saved with it, undoable, readable in `project_get_state`.
7. Agents can list, add, update (time, note, color) and remove markers with MCP tools, and read the
   note to act on it.

## Non-goals (for now)

- Range markers (a marker with a duration).
- Markers attached to a clip, or to a media file, that travel with it.
- A marker list panel or an index window.
- Exporting markers (chapters in the file, EDL, YouTube chapters).
- Markers shifting with ripple delete or ripple edits. Markers stay where they are, as in Resolve.

## Anti-goals

- A marker press that lands late or rounds to a different moment than the playhead shows.
- Markers that cost anything per frame: the flags must not re-render on playhead movement (rule 24).
- Any marker power the user has that agents lack, or the other way round.
- Clutter: the flags must stay small and quiet in the ruler, not cover the timecode labels.

## Decided

- **Where markers live (my call):** a top-level record in the project document,
  `ProjectState.markers: Record<MarkerId, Marker>`, keyed by id, like clips and junctions. Each
  marker names its `compositionId`. The obvious alternative, an array on the composition, was
  rejected: the history policy treats an array as one field, so every marker edit would clash with
  every other one. An agent couldn't undo its markers after the user added one, which breaks the
  "user and agent side by side" intent. With a record, each marker undoes on its own.
  - The project's validation rejects a marker whose composition doesn't exist.
  - Deleting a composition deletes its markers in the same command. Duplicating one copies them with
    new ids. These touch the composition commands because the data lives in `project`; the
    `Marker` type and `markers` field are declared in `project`'s types.
  - The file format reads `markers` with a default of none, so older files open unchanged.
- **Marker shape:** `{ id, compositionId, time: Micros, note: string, color: MarkerColor }`. `note`
  may be empty.
- **Colors:** a short fixed set of named colors (six, such as red, orange, yellow, green, blue,
  purple), stored by name, not as a CSS value. New markers use the color picked last (default blue).
  The names map to theme tokens or palette values in the marker module.
- **Module:** a new feature module, `marker`, owns everything: commands, MCP tools, the flags in the
  ruler, the editor popover, the keybindings and the snap contribution (rule 10). It requires
  `project`, `timeline` and `preview` only through their public `index.ts`.
- **Snapping:** the timeline gets a new point, `timelineSnapTargets`, read wherever snap candidates
  are gathered (clip move, trim, and now the ruler scrub). The marker module contributes the open
  composition's marker times to it. The timeline itself never knows markers exist.
- **Ruler scrub snapping (my call):** the ruler scrub doesn't snap to anything today. With markers
  it snaps to the full set: clip edges, junction cuts and markers, as in Premiere with snapping on.
  Holding Ctrl while scrubbing turns snapping off, the same as the other drags. This changes how
  scrubbing feels everywhere, on purpose: landing the playhead exactly on a cut is part of the
  productivity goal.
- **Commands:** `marker.add`, `marker.update` (time, note, color, any subset), `marker.remove`
  (one or many ids). All undoable, one undo step per gesture (a flag drag sends one `marker.update` on
  release). Two markers may share a time; nothing forbids it.
- **Jumping:** Shift+M and Ctrl+Shift+M resolve to the preview's existing seek command, so they work
  the same for the user and through `preview_seek` for agents.
- **MCP tools:** `marker_add`, `marker_update`, `marker_remove` (thin `commandTool` wrappers) and
  `marker_list` (markers of a composition, by time). Markers also appear in `project_get_state` because
  they are part of the composition.
- **Times:** integer microseconds; a new marker snaps to the frame the playhead shows.

## Left to the builder

- The exact flag shape and size in the ruler, and how the note shows on hover (follow the Mesa de
  Noche look, `docs/prototype/designs/b-mesa-de-noche.html`; sharp corners, no pills).
- The editor popover's layout (note field and color swatches), and whether Enter saves and Escape
  cancels.
- Whether the flags also draw a faint line down through the lanes (only if it stays quiet).
- How the six color names map to tokens.
- Tests: only for marker commands' undo and validation, and for snapping to markers, per rule 3.
