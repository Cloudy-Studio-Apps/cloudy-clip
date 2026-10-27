# timeline

Editing tracks and clips, and the timeline panel.

- `logic/` holds pure, tested functions: overlap checks, trim clamping, snapping, geometry.
- Rules: clips never overlap on a track (move/add fail with `timeline.overlap`); trims are clamped to the source media, neighbours, and a one-frame minimum; clips only move between tracks of the same kind.
- UI: page-virtualized lanes, gestures in `ui/clip-gesture.ts` (DOM feedback while dragging, one command on release), imperative playhead.
- View state (zoom, selection) is `TimelineApi.view` (per kernel, not in history); `TimelineApi.setZoom`, `selectClip`.
- Tier: core. Requires: `project`, `media`, `preview`. Contributes: panel `timeline.panel` (bottom); keybindings `timeline.split` (S), `timeline.delete` (Delete), `timeline.delete-backspace` (Backspace).

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
