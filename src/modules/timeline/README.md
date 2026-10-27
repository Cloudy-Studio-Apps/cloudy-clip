# timeline

Editing tracks and clips on the timeline, and the timeline panel: ruler, track headers, lanes,
clips, playhead and the toolbar (split, delete, add track, zoom).

- **Tier:** core
- **Requires:** `project`, `media`, `preview`
- **Contributes:** panel `timeline.panel` (bottom); keybindings `timeline.split` (S),
  `timeline.delete` (Delete), `timeline.delete-backspace` (Backspace)
- **Points it owns:** —
- **API** (`useModule(timelineRef)`): `view` (zoom and selection, per kernel, not in history),
  `setZoom`, `selectClip` (selecting a clip selects its linked partners). The selection is shared:
  the preview's canvas tools select through it.
- **Files:**
  - `timeline.track.commands.ts` (tracks), `timeline.clip.commands.ts` (clips), shared checks in
    `timeline.guards.ts`; `timeline.commands.ts` lists them.
  - `logic/`: pure, tested functions: overlap checks, trim clamping, snapping, geometry, links
    (`links.ts`: `partnersOf`, `withPartners`) and linked trims (`trim.ts`).
  - `ui/`: page-virtualized lanes (`TimelinePanel`), `clip.gesture.ts` (DOM feedback while dragging,
    one command on release), the playhead positioned by `playhead.hook.ts` without renders.
- **Rules:** video tracks hold pictures only, audio tracks hold sound. Adding a video file creates
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
| `timeline.moveClip`       | `timeline_move_clip`        |
| `timeline.trimClip`       | `timeline_trim_clip`        |
| `timeline.splitAt`        | `timeline_split`            |
| `timeline.deleteClips`    | `timeline_delete_clips`     |
| `timeline.unlinkClips`    | `timeline_unlink_clips`     |
| `timeline.setTrackMuted`  | `timeline_set_track_muted`  |
| `timeline.setTrackHidden` | `timeline_set_track_hidden` |
