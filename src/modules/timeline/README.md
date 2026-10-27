# timeline

Editing tracks and clips on the timeline, and the timeline panel: ruler, track headers, lanes,
clips, playhead and the toolbar (split, delete, add track, zoom).

- **Tier:** core
- **Requires:** `project`, `media`, `preview`
- **Contributes:** panel `timeline.panel` (bottom); keybindings `timeline.split` (S),
  `timeline.delete` (Delete), `timeline.delete-backspace` (Backspace)
- **Points it owns:** —
- **API** (`useModule(timelineRef)`): `view` (zoom and selection, per kernel, not in history),
  `setZoom`, `selectClip`. The selection is shared: the preview's canvas tools select through it.
- **Files:**
  - `timeline.track.commands.ts` (tracks), `timeline.clip.commands.ts` (clips), shared checks in
    `timeline.guards.ts`; `timeline.commands.ts` lists them.
  - `logic/`: pure, tested functions: overlap checks, trim clamping, snapping, geometry.
  - `ui/`: page-virtualized lanes (`TimelinePanel`), `clip.gesture.ts` (DOM feedback while dragging,
    one command on release), the playhead positioned by `playhead.hook.ts` without renders.
- **Rules:** clips never overlap on a track (move/add fail with `timeline.overlap`); trims are
  clamped to the source media, neighbours and a one-frame minimum; clips only move between tracks of
  the same kind; a split keeps the clip's transform on both halves.
- **Not yet:** markers, groups, compositions, ripple and other Pro tools, magnetic main track.

| Command                   | MCP tool                    |
| ------------------------- | --------------------------- |
| `timeline.addTrack`       | `timeline_add_track`        |
| `timeline.removeTrack`    | `timeline_remove_track`     |
| `timeline.addClip`        | `timeline_add_clip`         |
| `timeline.moveClip`       | `timeline_move_clip`        |
| `timeline.trimClip`       | `timeline_trim_clip`        |
| `timeline.splitAt`        | `timeline_split`            |
| `timeline.deleteClips`    | `timeline_delete_clips`     |
| `timeline.setTrackMuted`  | `timeline_set_track_muted`  |
| `timeline.setTrackHidden` | `timeline_set_track_hidden` |
