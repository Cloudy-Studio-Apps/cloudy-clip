# Changelog

All notable changes to Cloudy Clip are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

Leer en [español](CHANGELOG.es.md).

## [Unreleased]

### Added

- **Follow path:** draw a path on the frame, freehand (one stroke, smoothed into a few points) or
  with the pen (click for corners, drag for curves), and any number of clips follow it. Progress
  (0–100 %, keyed for you from the clip's start to its end) moves a clip along the path at an even
  speed, so ease presets and loops shape its motion; Position becomes an offset from the path, so
  clips can travel side by side, and Orient along path turns a clip with the curve. Reshape the
  path on the canvas (drag points and handles, double-click to add a point, Delete to remove one)
  and every clip on it follows. Stopping or deleting a path leaves clips where they are.
- A **Paths** section in the Library lists the open composition's paths with how many clips follow
  each, and a **Follow path** section in the inspector picks a clip's path or draws a new one.
- A clip that follows a path shows the path's name on the timeline; click it to edit the path on
  the canvas, stop following it, or delete it.
- Agents have `path_create`, `path_update`, `path_remove`, `path_attach`, `path_detach` and
  `path_list`. Projects with paths are saved as version 5.
- **Pivot, stretch and flip in Transform**, the After Effects way. Each picture has a pivot
  (Pivot X/Y) that scale, stretch and rotation turn about; Position places the pivot. Stretch
  sets Width and Height on their own for squash and stretch, and a negative value flips that
  axis, so a turn can animate smoothly through zero. Flip Horizontal and Flip Vertical (in the
  Transform section and the clip menu) mirror the clip and every key of that value in one step.
  All of it can hold keys.
- On the canvas, side handles stretch one axis (dragging past the pivot flips it) and Alt+drag on the
  crosshair moves the pivot without moving the picture; corners and the rotate handle now work about the
  pivot.
- Agents get `transform_flip`, and `element_set_props` takes `scaleX`, `scaleY`, `pivotX` and
  `pivotY` under `transform`.
- **Subtitles:** mark text clips as subtitles, each with a style (Classic, Punchy, Intense, Whisper
  or your own) that sets its look and position. Change a style and every subtitle that followed it
  changes; a subtitle you changed by hand keeps its own values (shown with a diamond, with a
  Reset to style action).
- A **Subtitles** page lists every cue with editable words and times, adds, splits and merges cues,
  nudges times with the `[`, `]` and Alt+arrow keys, and shows the picture and sound under the
  timeline. Import and export `.srt` (and read `.vtt`).
- Agents get `subtitle_add_style`, `subtitle_update_style`, `subtitle_rename_style`,
  `subtitle_remove_style`, `subtitle_reorder_styles`, `subtitle_mark`, `subtitle_unmark`,
  `subtitle_reset_to_style`, `subtitle_add_cue`, `subtitle_split_cue`, `subtitle_merge_cues`,
  `subtitle_import` and `subtitle_to_srt`.

## [0.1.0] - 2026-11-17

### Added

**The Tint page (color grading)**

- A new Tint tab between Edit and Sound, with the viewer, scopes, the clips strip and the tools side by side.
- Grades as layers (Baby Seal) or as nodes (Leader Seal): two views of the same grade, switched with the seal switch. Layers can be grouped side by side, stacked or per channel, with wires and key joins in the node view.
- Tools: Basics, wheels (Primary, Log, Bars and Zones), curves, Color mix, Warper, Creative, the RGB mixer, and limits by color and brightness with shared keys.
- Camera color spaces, LUT files (.cube), looks and stills.
- Copy and paste grades, versions, shot groups and a whole-timeline grade.
- Match a shot to another, white balance, color charts and skin tones.
- Grade values take keyframes, so a grade can change over a shot.
- Scopes, bypass and before/after, and viewer tools.
- Grades draw on the GPU, the same in the preview, captures and the export.
- Agents can grade through new MCP tools.

**Volume lines and automation (Sound page)**

- A volume line over every audio clip, made from its volume keyframes: drag a point, double-click to add one, Delete to remove the selected one. It follows speed changes, ramps and splits.
- A volume line per track that stays put when clips move or split. It plays in the preview and is written into the export, also inside placed compositions.
- Draw volume: draw a track's or a clip's line with the pen. Strokes are smoothed to within 0.5 dB and only change the stretch you drew over.
- Fader automation with Read, Touch and Latch on every strip. A fader move while playing is recorded into the line as a trim; one playback is one undo step, loops don't stack and skipped stretches are left alone.
- Pointer tools on the transport: Select, Cut (a blade: click a clip to cut it there, Shift cuts every track), Fade, Draw volume and Scrub.

**Groups, audio formats and stems**

- Group tracks (for example "Dialogue" or "Music & FX") with their own strip, fader, mute and effects. Tracks are sent to a group from the Sends to picker, which can also make a new group. Mix A and B share the same groups; only their settings switch.
- A muted group is silent and no longer ducks other tracks.
- Sound-only exports in WAV, FLAC, AAC and Opus, at 44.1 or 48 kHz; WAV and FLAC in 16 or 24 bit, with dither at 16 bit.
- Stems: one file per group, plus "Other" and the full "Mix", from one FFmpeg run. They add up to the mix before Master.
- Master gets Pan, Mute, Read/Touch/Latch and its own volume line on the Sound timeline.

**Delivery**

- Delivery standards: Spotify, Apple Podcasts, EBU R128 and ATSC A/85 (with their sources), YouTube and TikTok (common practice, no official figure) and Custom.
- Analyze whole mix: integrated loudness, loudness range and true peak of exactly what gets exported, plus a list of problem spots that are also marked on the ruler. Clicking a problem moves the playhead there. It runs in the background, can be cancelled and shows when it's out of date.
- Match target: one undo step through Master's new Trim (−24 to +24 dB), adding a limiter if needed. Exports can match on their own copy without changing the project.
- Spectrum and stereo phase meters in the Loudness tab, and the target line in "Loudness over time".

**Quick tools**

- Find beats: beats found from the sound, shown as ticks on the timeline and used for snapping. Tempo changes are followed.
- Strip silence: removes quiet stretches after a preview of the cuts. On the Sound page it cuts sound only and leaves gaps; on the Edit page (clip menu) it cuts picture and sound and closes the gaps.
- Match level: brings the selected clips to the same loudness, measured as heard, keeping the shape of their volume keyframes.

**Other**

- The compressor shows its live gain reduction in the Channel tab.
- The limiter now holds true peaks (the peaks between samples) under its ceiling, in the preview and the export alike.
- Agents can do everything above through new MCP tools, including cancelling their own scans and reading stored measurements.

### Changed

- Exported volume envelopes (clip keyframes, fades, track lines) change smoothly sample by sample instead of in steps of up to 85 ms.
- The loudness meter reads true peaks the way FFmpeg's measurement does.
- Agent tools that wait on a long job answer within about 25 seconds and report progress; asking again joins the same job.
- Volume-line tools take a `target` (a track or `"master"`) instead of `trackId`.
- `project_get_state` returns a compact overview: every composition in one line, one composition in full (`compositionId`, else the open one), and media, bins, solids, grade groups, LUTs and stills only when asked for through `include`.
- Line and pass tools return the ids of the keys they wrote.

### Fixed

- FFmpeg jobs no longer keep running after the app quits, and their half-written files are removed. Leftovers from a crash are cleaned up at the next launch.
- The Sound page no longer grows wider than the window, so the mixer and the small preview are always visible.
- Video is drawn with the right brightness range for each kind of file. Some files had their blacks and whites stretched a second time, which crushed shadows and clipped highlights.
- Trimming or splitting a clip clamps its fades to the new length, and the trim tool returns the clip as stored.
- Every sound-only output has exactly the requested length.
- Beat finding keeps the full tempo when the kicks have alternating gaps.
- A moved keyframe stops at the clip's edge.
- `speed_reset` after a ramp restores a round original length.
- Fixes to many MCP tools found in a full test pass: clearer refusals for unknown packs, topics, jobs and colours, relink keeps a chosen name, `preview_capture_frame` leaves the agent's playhead alone, `junction_set` keeps the options given with a new preset, and hiding an audio track is refused.

## [0.0.1] - 2026-11-09

The parts of this release that belong to the Sound page.

### Added

- The Sound page: the audio-only timeline, a mixer with one strip per audio track and Master pinned at its edge, a small preview, and the Clip, Channel, Loudness and Deliver tabs.
- Track volume, pan, mute and solo; Mix A/B; Mono, Dim and the speaker volume.
- Loudness metering (BS.1770) and a loudness history graph.
- Effects on tracks and Master: EQ, compressor, gate, de-esser, limiter, ducking and noise reduction. The preview matches the export sample for sample. Presets, built-in and your own.
- Loop and audio scrub on the Sound page.
- Voice recording onto a track (Linux), saved as WAV next to the project. Record works without arming by making a new Voice track.
- Markers on the Sound page, in their own row under the ruler.

### Fixed

- The app no longer freezes when a video's player is muted while not on screen (a WebKitGTK crash).
