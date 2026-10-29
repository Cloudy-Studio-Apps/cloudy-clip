# timeline

Editing tracks and clips on the timeline, and the timeline panel: ruler, track headers, lanes,
clips, playhead and the toolbar (split, delete, add track, zoom).

- **Tier:** core
- **Requires:** `project`, `element` (clip labels, colors, bodies), `media`, `preview`
- **Contributes:** panel `timeline.panel` (bottom); keybindings `timeline.split` (S),
  `timeline.delete` (Delete), `timeline.delete-backspace` (Backspace)
- **Points it owns:** —
- **API** (`useModule(timelineRef)`): `view` (zoom and selection, per kernel, not in history),
  `setZoom`, `selectClip` (selecting a clip selects its linked partners). The selection is shared:
  the preview's canvas tools select through it. `dropTarget(clientX, clientY)` gives the track and
  time under a screen point, for drops from other panels (the Text tab). Exported helpers for
  modules that place their own clips: `findOverlap`, `freeTrack`, `overlapError`,
  `selectionSubject`. `CreateTiles({ panel })`: the create tiles of a side panel.
- **Files:**
  - `timeline.track.commands.ts` (tracks), `timeline.clip.commands.ts` (clips), shared checks in
    `timeline.guards.ts`; `timeline.commands.ts` lists them.
  - `timeline.element.command.ts`: `timeline.addElement` (`kind`, optional `props`, `start`
    (default the playhead), `duration` (3 s), `trackId`): a clip of an element without a file. No
    track: the top track of the element's first track kind with room, or a new top one (same undo
    step). Fails `element.unknown_kind`, `timeline.needs_source` (media: use `addClip`),
    `timeline.track_not_found`, `timeline.kind_mismatch`, `timeline.overlap`; `props` are checked first (`parsePatch`, and their groups against the
    target track's kind: `element.invalid_props` / `element.read_only`) before any track or clip
    is written, then stored through a nested `element.setProps` (minimized).
  - `logic/`: pure, tested functions: overlap checks, trim clamping, snapping, geometry, links
    (`links.ts`: `partnersOf`, `withPartners`) and linked trims (`trim.ts`).
  - `ui/`: page-virtualized lanes (`TimelinePanel`), `clip.gesture.ts` (DOM feedback while dragging,
    one command on release), the playhead positioned by `playhead.hook.ts` without renders.
    `CreateTiles.tsx` lists every element's `create` entries for a panel; `create.gesture.ts`:
    click-or-drag on a tile (DOM ghost, no renders), a click adds at the playhead, a drop goes
    through `dropTarget` (the lane under the pointer when the element may sit there, else only the
    time).
- **Rules:** video tracks hold pictures (and text clips) only, audio tracks hold sound. Every
  command works on any clip kind; a clip without a file (`mediaId`; text) trims to any length
  (`TrimLimits.sourceless`) and keeps `sourceIn` at 0 when split. Splitting copies `props` to
  each half. A clip shows its element's `display`: label, color (`var(--<token>)`) and body
  (filmstrip, waveform or none), worked out once per project change (one selector). Adding a video file creates
  its picture and, if ffprobe found sound (`mediaHasAudio`), a linked sound clip (`Clip.linkId`) on
  the first audio track with room (a new one if none). Linked clips are moved (same offset, each on
  its own track), trimmed (same edge, tightest limit), split (halves linked left/right) and deleted
  together until `timeline.unlinkClips`; if any of them can't make the change, nothing changes.
  Clips never overlap on a track (move/add fail with `timeline.overlap`); trims are clamped to the
  source media, neighbours and a one-frame minimum; clips only move between tracks of the same
  kind; a split keeps the clip's transform on both halves; only audio tracks can be muted.
- **Not yet:** markers, groups, compositions, ripple and other Pro tools, magnetic main track.

| Command                   | MCP tool                    |
| ------------------------- | --------------------------- |
| `timeline.addTrack`       | `timeline_add_track`        |
| `timeline.removeTrack`    | `timeline_remove_track`     |
| `timeline.addClip`        | `timeline_add_clip`         |
| `timeline.addElement`     | `timeline_add_element`      |
| `timeline.moveClip`       | `timeline_move_clip`        |
| `timeline.trimClip`       | `timeline_trim_clip`        |
| `timeline.splitAt`        | `timeline_split`            |
| `timeline.deleteClips`    | `timeline_delete_clips`     |
| `timeline.unlinkClips`    | `timeline_unlink_clips`     |
| `timeline.setTrackMuted`  | `timeline_set_track_muted`  |
| `timeline.setTrackHidden` | `timeline_set_track_hidden` |
