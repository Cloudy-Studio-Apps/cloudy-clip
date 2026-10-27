# Linked video and audio clips

## Intent

A video track holds only picture; an audio track holds only sound, as in every video editor.
Placing a video file on the timeline creates two clips from it: the picture on a video track and
the sound on an audio track, at the same time. The two are **linked** so they stay in sync. An
**Unlink** action breaks the link; afterwards each clip is edited on its own.

Today a video clip plays its own sound (`TrackKind` docs: "Video tracks hold video clips (with
their audio)"). That goes away.

## Goals

- Video clips never make sound. Sound comes only from clips on audio tracks.
- Adding a video file (drop from the library, `timeline.addClip`, the MCP tool) creates a video
  clip and an audio clip of the same source range, same start, linked.
- While linked, the pair acts as one clip:
  - **select**: selecting one selects both;
  - **move**: moving one moves the other by the same time offset (each stays on its own track
    kind; a move to another track only changes the track of the dragged clip);
  - **trim**: trimming an edge trims both to the same edge time;
  - **split**: splitting cuts both; the left halves stay linked to each other, the right halves
    are a new linked pair;
  - **delete**: deleting one deletes both.
- **Unlink** (button in the timeline toolbar, enabled when the selection contains a linked clip;
  command + MCP tool) removes the link from the selected clips. One undo step; Ctrl+Z relinks.
- Agents see links in `project_get_state` and can do everything the user can (rule 13/18).

## Non-goals

- Relinking clips that were never linked, or relinking after unlink other than by undo.
- Detaching audio from an existing pre-change project (projects are not persisted yet).
- Audio waveforms on audio clips, volume, fades, J/L-cut tools.

## Anti-goals

- The picture and sound of a linked pair drifting apart after any edit. Every linked edit is one
  command and one undo step, validated as a whole: if either clip can't make the change (overlap),
  the whole command fails and nothing changes.
- Audio playing twice (from the video element and the audio clip).

## Behaviour details

- **Files without sound**: a video file with no audio stream gives only a video clip. The native
  `ffprobe` (proxy step, `src-tauri/src/media/proxy.rs`) already reads streams; it reports
  `hasAudio` to the webview with the proxy event, stored in the media probe. When it is unknown
  (no FFmpeg), assume the file has sound. _(Builder's call how it travels; the probe is the place.)_
- **Audio files** (mp3, wav, …): unchanged, one clip on an audio track.
- **Where the audio clip goes**: the first audio track where the range is free; if none is free
  (or none exists), a new audio track is created. Dropping a video on a specific video track sets
  the video track; _my call:_ dropping a video on an audio track puts the sound on that track and
  the picture on the first free video track (new one if needed).
- **Moving between tracks**: a linked clip may move to another track of its own kind; the partner
  only shifts in time. If the partner's shifted range overlaps on its track, the move fails
  (`timeline.overlap`), as a single clip would.
- **Trim**: clamping (source length, neighbours, one-frame minimum) is applied to both; the
  tighter result wins so both edges end at the same time.
- **Split by time with no clipIds** already splits every clip under the playhead; with clipIds, a
  linked clip's partner is added.
- **Delete with clipIds**: partners are added.
- **Selection** is ephemeral view state; `selectClip` expands to linked partners. Additive
  selection toggles the pair.
- **Gesture feedback**: while dragging/trimming, the partner's DOM moves with the dragged clip
  (still no React state per frame; one command on release).
- **Link indicator**: linked clips show a small link icon (`lucide-react` `Link`) in the clip
  header. _(My call.)_
- **Video track header**: the mute button goes away on video tracks (they make no sound); hide
  stays. Audio tracks keep mute. `timeline.setTrackMuted` on a video track fails with
  `timeline.kind_mismatch`. _(My call.)_
- **Return shape**: `timeline.addClip` returns `{ clips: Clip[] }` (video first) instead of one
  clip; the README and tool description say so. _(My call; its callers are the timeline's own drop
  handlers in `TrackLane.tsx` and `TimelinePanel.tsx`, and the MCP tool.)_

## Model

- `Clip.linkId?: string`: clips sharing a `linkId` are linked. Missing means unlinked. A link has
  exactly two clips in v1 (one video, one audio) but code should not assume more than "the other
  clips with this id".
- A media item of kind `video` may sit on an audio track (its sound). `TrackKind` docs change:
  video tracks hold pictures, audio tracks hold sound (from audio or video files).

## Commands and tools (timeline module)

| Command                        | MCP tool                | Change                                                                                |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| `timeline.addClip`             | `timeline_add_clip`     | Video media creates the linked pair. New optional `audioTrackId`. Returns both clips. |
| `timeline.moveClip`            | `timeline_move_clip`    | Moves partners by the same offset.                                                    |
| `timeline.trimClip`            | `timeline_trim_clip`    | Trims partners.                                                                       |
| `timeline.splitAt`             | `timeline_split`        | Splits partners; right halves get a new `linkId`.                                     |
| `timeline.deleteClips`         | `timeline_delete_clips` | Deletes partners.                                                                     |
| `timeline.unlinkClips` _(new)_ | `timeline_unlink_clips` | Input `clipIds`; removes `linkId` from them and their partners.                       |

Each is undoable and one history step. TSDoc + README table updated (rules 1, 17).

## Preview engine

- Media elements are chosen by **track kind**, not media kind: clips on video tracks get a
  `<video>` slot that is always muted; clips on audio tracks get an `<audio>` slot (for a video
  file, the `<audio>` element loads the same URL and decodes only the sound).
- Both elements follow the clock independently with the existing drift correction.

## Constraints

- Follow CLAUDE.md: commands only via the bus, `ctx.mutate`, `CommandFailure` codes
  `timeline.*`, integer micros, no React state on per-frame paths, stable selectors.
- Tests next to logic: link expansion, linked move/trim/split/delete, overlap failure leaves
  state unchanged, unlink + undo.

## Left to the builder

- Where link expansion helpers live (`logic/links.ts` suggested), how `hasAudio` reaches the probe,
  exact toolbar placement of Unlink, and the keyboard shortcut (none required).
