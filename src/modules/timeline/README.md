# timeline

Editing tracks and clips on the timeline, and the timeline panel: ruler, track headers, lanes,
clips, playhead and the toolbar (split, delete, add track, zoom).

- **Tier:** core
- **Requires:** `project`, `element` (clip labels, colors, bodies), `junction` (kind limits when
  clip edits change joined clips), `media`, `preview`
- **Contributes:** panel `timeline.panel` (bottom); keybindings `timeline.split` (S),
  `timeline.delete` (Delete), `timeline.delete-backspace` (Backspace); with a junction selected
  they run `junction.remove` instead of deleting clips
- **Points it owns:** —
- **API** (`useModule(timelineRef)`): `view` (zoom and selection, per kernel, not in history),
  `setZoom`, `selectClip` (selecting a clip selects its linked partners and clears the junction
  selection), `selectJunction(id | null)` (selecting a junction clears the clip selection;
  `view.junctionSelection`), `cutTarget(clientX, clientY)` (the cut under a point within 8 px, for
  drops from other panels), `highlightCut(cut | null)` (marks the cut's lane with `data-cut-target`
  while something is dragged over it, no renders). The selection is shared:
  the preview's canvas tools select through it. `dropTarget(clientX, clientY)` gives the track and
  time under a screen point, for drops from other panels (the Text tab). Exported helpers for
  modules that place their own clips: `findOverlap`, `freeTrack`, `overlapError`,
  `selectionSubject`. `CreateTiles({ panel })`: the create tiles of a side panel.
- **Files:**
  - `timeline.track.commands.ts` (tracks), `timeline.clip.commands.ts` (add, unlink),
    `timeline.move.commands.ts` (move, trim), `timeline.split.commands.ts` (split, delete), shared
    checks in `timeline.guards.ts` (`checkLayout`: the whole layout through `project`'s
    `findLayoutConflict`); `timeline.commands.ts` lists them.
  - `timeline.junctions.ts`: what the clip commands share to keep junctions valid: `moveClips`,
    `followMove`, `rippleTrim`, `fitJunctions`, `junctionsOverlapping`, and `commitState` (writes
    a state worked out with `project`'s pure helpers as one undo step).
  - `timeline.element.command.ts`: `timeline.addElement` (`kind`, optional `props`, `start`
    (default the playhead), `duration` (3 s), `trackId`): a clip of an element without a file. No
    track: the top track of the element's first track kind with room, or a new top one (same undo
    step). Fails `element.unknown_kind`, `timeline.needs_source` (media: use `addClip`),
    `timeline.track_not_found`, `timeline.kind_mismatch`, `timeline.overlap`; `props` are checked first (`parsePatch`, and their groups against the
    target track's kind: `element.invalid_props` / `element.read_only`) before any track or clip
    is written, then stored through a nested `element.setProps` (minimized).
  - `logic/`: pure, tested functions: overlap checks, trim clamping, snapping, geometry, links
    (`links.ts`: `selectionSubject`; `partnersOf`/`withPartners` now live in `project`) and linked trims (`trim.ts`).
  - `ui/`: page-virtualized lanes (`TimelinePanel`), `clip.gesture.ts` (DOM feedback while dragging,
    one command on release), the playhead positioned by `playhead.hook.ts` without renders.
    `CreateTiles.tsx` lists every element's `create` entries for a panel; `create.gesture.ts`:
    click-or-drag on a tile (DOM ghost, no renders), a click adds at the playhead, a drop goes
    through `dropTarget` (the lane under the pointer when the element may sit there, else only the
    time).
  - `junction.display.ts`: `useTrackChips(trackId)`, the chips of a track (label, icon, cut time),
    one selector per project change; `ui/JunctionChip.tsx`: the glass chip (tokens only), width
    `max(duration, 28 px)`, centered on the cut; its edges drag the duration (`ui/junction.gesture.ts`:
    DOM feedback clamped by `clampDuration(durationLimits(…))`, one `junction.set` on release).
    A chip of an unregistered kind shows muted. `TrackLane` draws only the chips in the rendered
    pages. `logic/cut.ts`: `cutAtX`.
- **Rules:** video tracks hold pictures (and text clips) only, audio tracks hold sound. Every
  command works on any clip kind; a clip without a file (`mediaId`; text) trims to any length
  (`TrimLimits.sourceless`) and keeps `sourceIn` at 0 when split. Splitting copies `props` to
  each half. A clip shows its element's `display`: label, color (`var(--<token>)`) and body
  (filmstrip, waveform or none), worked out once per project change (one selector). Adding a video file creates
  its picture and, if ffprobe found sound (`mediaHasAudio`), a linked sound clip (`Clip.linkId`) on
  the first audio track with room (a new one if none). Linked clips are moved (same offset, each on
  its own track), trimmed (same edge, tightest limit), split (halves linked left/right) and deleted
  together until `timeline.unlinkClips`; if any of them can't make the change, nothing changes.
  Clips never overlap on a track except by exactly the duration of a junction joining them (or
  of the picture pair their sounds are linked to; `allowedOverlap` in `project`), and every guard
  goes through that rule: `findOverlap(…, self)`, `neighbourBounds` (a joined neighbour bounds a
  clip at its own edge, except on the edge being trimmed), `checkLayout`; move/add fail with `timeline.overlap`. Trims are clamped
  to the source media, neighbours and a one-frame minimum; clips only move between tracks of the
  same kind; a split keeps the clip's transform on both halves; only audio tracks can be muted.
  `snapCandidates` include each junction's cut (the middle of its overlap).
- **Junctions** (spec rules 2, 10, 11): after every clip command no junction is stale
  (`staleJunctions` is empty).
  - **Move:** a junction whose clips both moved by the same offset is kept; a different overlap
    becomes its duration if the kind's limits allow it (else `junction.invalid_duration`, nothing
    changes); touching, apart or on different tracks removes an overlapping junction, no shift
    back. The result is the clip plus `removedJunctions`.
  - **Drag validity:** a dragged clip may overlap its joined neighbour by any length the junction's
    kind accepts (`overlapAccepted` in `logic/joined.ts`: within `durationLimits`, any positive
    overlap for an unregistered kind), the same rule `timeline.moveClip` applies.
  - **Trim:** trimming a joined edge (A's end, B's start), shorter or longer, keeps the overlap:
    B's start stays where the junction needs it, and B's end, everything after it on the track and
    their partners move by the change (`rippleTrim`). The joined neighbour doesn't limit that edge
    (`trimLimits(…, edge)` / `neighbourBounds(…, rippleEdge)`); anything unlinked in the way of
    the ripple refuses the trim (`timeline.overlap`). Extending B's start is still limited by its
    source and by time 0. When a clip gets too short, the junction shrinks to the kind's new
    maximum in the same step and what follows moves later by the difference.
  - **Split:** a junction on a split clip's end moves to its right half; one on its start stays
    on the left half (same id). Inside an overlap: `junction.split_in_overlap` with `clipIds`;
    without them, those clips and their partners stay whole and the rest are split.
  - **Delete:** the junctions of deleted clips go too; nothing shifts. The result adds
    `removedJunctions`.
  - **Remove track:** `timeline.removeTrack` also removes the junctions of the track's clips and
    returns `removedJunctions`; if that would leave linked clips on other tracks overlapping
    (their pictures' junction is gone), it fails with `timeline.remove_joined` and changes
    nothing: remove the transitions on that track first.
  - **Unlink:** refused with `timeline.unlink_joined` while the clips' sounds overlap only
    because their pictures are joined (remove the junction first); nothing changes.
  - A junction whose kind isn't registered is kept where the rules allow and its limits are not
    checked.
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
