# Clip menu and clip speed

Cloudy Clip's clips have a right-click menu that barely does anything, and clips can't change speed.
This design covers both, as two projects built in order:

1. **The clip menu:** a real menu with the tools an editor reaches for.
2. **Clip speed:** a slider and presets on any video or audio clip, then Reverse and Freeze frame.

The approved look is the last mockup of the session, `speed-v4.html` (kept in `.superpowers/brainstorm/`,
which git ignores; the sections below are the source of truth).

## Why

The menu is where a CapCut user expects to find everything, and today it only offers Group into
composition and Make unique. Speed is one of the most common short-form edits and the app can't do it:
`Clip` assumes one second on the timeline is one second of the file. The reference for speed is DaVinci
Resolve's Change Clip Speed dialog and Speed Change section, made simpler, with a slider instead of
Resolve's scrub field.

## Goals

- Everything in the menu works on the same selection the user sees highlighted.
- Every tool is a command: undoable as one step, and available to agents (`CLAUDE.md` rules 14, 18).
- Preview and export agree on speed, including sound.
- Speed has two homes that always show the same values: a small box above the clip, and a Speed section
  under Transform in the inspector's Video tab.

## Non-goals

- Speed ramps, keyframes and Ease (the app has no keyframes). One constant speed per clip.
- Resolve's Frames per Second field. It's speed in other units.
- Frame interpolation or optical flow. Frames are picked from the source.
- Speed on composition clips, text, images, solids and stickers. Only clips that play a file's time
  (`clip.mediaId` set and `followsFileTime` true). The menu leaves Speed and Freeze frame out elsewhere.
- Copying to the OS clipboard, or pasting between projects.
- Submenus. Nothing in the approved menu needs one.

## Anti-goals

- Fails if preview and export disagree about which frame or sound plays at a time.
- Fails if an untouched project plays or exports differently: defaults are never stored, like `Clip.sound`.
- Fails if the box or menu ignores the Mesa de noche look or adds a new visual language.
- Fails if a slider drag writes to the project on every move or re-renders React per frame (rules 15, 24).

## Project 1: the clip menu

### The menu component (`@/ui` `ContextMenu`)

`MenuList` already draws shortcuts and submenus. `MenuItem` gains `icon` and `group`. The menu draws
groups with a dashed `border-border-strong` rule, icons from `lucide-react`, and stays on screen (clamps
at the window's edges, as `Popover` does). Bin, composition and app menus use the same list, so they get
this too. Destructive items keep `text-destructive`.

### Opening it on a clip

- A right click on an unselected clip selects it and its linked partners first. Today `TimelineClip`
  ignores non-left presses. A right click on a clip inside the selection keeps the selection.
- Items act on the selection. A multi-selection shows only the items that work on many clips.
- Right click never starts a drag.

### Points

- `ClipActions.items(clip)` entries declare a group and an order, so modules can place items without
  knowing each other. The group order, top to bottom: clipboard, timing, edit, reset, composition,
  library, delete.
- `TimelineMenuItems.items()` receives where the click landed (`time`, `trackId`), so Paste on the empty
  timeline can land there. `ClipActions.items(clip)` doesn't need it: Paste in a clip's menu uses the
  playhead, because the spot under the pointer is taken by that clip.
- A feature adds its own items (rule 10): transform adds Reset transform, audio adds Reset sound,
  composition keeps its two, speed adds Speed... and Freeze frame. `timeline` itself adds the clipboard,
  edit and delete items, and Show in Library: `timeline` requires `media`, so `media` can't contribute
  to a timeline point without a cycle, and calls `media`'s public API instead.

### The menu, top to bottom

| Group       | Item                       | Shows when                                    | Runs                         | Shortcut |
| ----------- | -------------------------- | --------------------------------------------- | ---------------------------- | -------- |
| Clipboard   | Cut                        | always                                        | new                          | Ctrl+X   |
|             | Copy                       | always                                        | new                          | Ctrl+C   |
|             | Paste                      | clipboard has clips                           | new                          | Ctrl+V   |
|             | Duplicate                  | always                                        | new                          | Ctrl+D   |
| Timing      | Speed...                   | file-time clips, one subject                  | project 2                    |          |
|             | Freeze frame               | a picture on a video track under the playhead | project 2                    |          |
| Edit        | Split at playhead          | playhead is inside the clip                   | `timeline.splitAt`           | S        |
|             | Unlink audio / Link audio  | see below                                     | `timeline.unlinkClips` / new |          |
|             | Disable clip / Enable clip | always                                        | new                          |          |
| Reset       | Reset transform            | the clip has a transform                      | `transform.reset`            |          |
|             | Reset sound                | the clip or its partner has `sound`           | `audio.resetSound`           |          |
| Composition | Group into composition     | always                                        | `composition.group`          |          |
|             | Make unique                | composition clips                             | `composition.makeUnique`     |          |
| Library     | Show in Library            | the clip has a file                           | new                          |          |
| Delete      | Ripple delete              | always                                        | new                          |          |
|             | Delete                     | always                                        | `timeline.deleteClips`       | Del      |

The empty part of the timeline gets Paste above its existing Composition Settings and Extend to fit.

### New commands

All live in `timeline` (except `media.reveal`), have Zod inputs, TSDoc, and validate before writing.

- **Clipboard: `timeline.copyClips`, `timeline.cutClips`, `timeline.pasteClips`, `timeline.duplicateClips`.**
  The clipboard is ephemeral (rule 16), per kernel and per actor, so an agent's copy doesn't replace the
  user's. It holds full clip copies with their offsets and track kinds, including `props`, `sound`,
  `speed`, shared groups and link groups.
  - Copy doesn't touch the project and isn't undoable. Cut is one undo step.
  - Paste takes `time` and an optional `trackId`. On the empty timeline it lands where the right click
    was. In a clip's menu, with Ctrl+V, and for agents without `time`, it uses the playhead.
  - Pasted clips keep their spacing and get new ids. Linked clips stay linked with a new `linkId`.
  - `trackId` anchors the first clip of that track's kind. The others of that kind keep their distance
    in tracks from it. Without `trackId`, each clip starts from its original track.
  - A clip whose track is taken at the new time goes on the first track of its kind with room, else a
    new track, all in one undo step.
  - Junctions aren't copied.
  - Pasting a composition clip into a composition it contains (at any depth) is refused with the same
    rule `composition.place` uses.
  - Duplicate pastes right after the end of the copied selection, with the same placement rules.
- **`timeline.rippleDelete`:** deletes the clips and their partners, then on each track that lost a clip,
  closes the time the deleted clips freed: their spans minus what other clips on that track still
  cover. That is less than the clip's length when a junction overlapped it, and gaps that were already
  there stay. Several deleted clips on a track add up. Junctions go as in `timeline.deleteClips`. A linked group that follows on
  two tracks moves together by the smaller of the two shifts, so it never slips out of sync. If the
  result would break the layout (`checkLayout`), nothing changes and it fails with `timeline.overlap`.
- **`timeline.setClipsDisabled`:** `{ clipIds, disabled }`, linked partners included. Stores
  `Clip.disabled: true`, absent otherwise. A disabled clip is drawn dimmed on the timeline, is skipped by
  `resolveFrame` and `mixdown`, and is left out of `usedMedia`. Its junctions stay; the other side plays
  through the transition against nothing.
- **`timeline.linkClips`:** exactly one clip on a video track and one on an audio track, both unlinked,
  from the same file, with the same `start`, `duration`, `sourceIn` and speed. That's how
  `timeline.unlinkClips` leaves them, so this undoes an unlink and nothing more. Otherwise
  `timeline.link_mismatch`. The menu shows Link audio when the selection is such a pair, disabled if
  they no longer match. Linking a separate recording to a video is out of scope.
- **`media.reveal`:** a `media` command that sets the Media page's view to the file's bin, selects the
  file and runs `pages.show`. Changing the user's page isn't something an agent should do, so it has no
  MCP tool.

Tools: `timeline_copy_clips`, `timeline_cut_clips`, `timeline_paste_clips`, `timeline_duplicate_clips`,
`timeline_ripple_delete`, `timeline_set_clips_disabled`, `timeline_link_clips`.

`Clip.disabled` and later `Clip.speed` save with the project (`workspace/logic/format.ts` keeps unknown
clip fields, so it needs no change) and show in `project_get_state` (rule 19).

Cut, Copy, Paste and Duplicate also appear in the app menu's Edit submenu. Their shortcuts do nothing off
the Edit page, because `mod` bindings run on every page.

## Project 2: clip speed

Build in this order: **check, forward speed, Freeze frame, Reverse.** Each stage ends working.

### Stage 0: a check on the real webviews

Before building, confirm on WebKitGTK that `HTMLMediaElement.playbackRate` plays a proxy smoothly from
0.1x to 10x, and whether `preservesPitch` works. Record it next to
`docs/superpowers/specs/2026-11-02-audio-preview-check.md`. Windows (WebView2) gets the same check when
available. If `preservesPitch` doesn't work on WebKitGTK, pitch correction in preview runs through the
pitch worklet `engine.audiograph.ts` already has. Its roughly 125 ms lead must be accounted for, and that
path also has to hold up at high speeds, so if it can't, stop and bring that back to the user.

### The value

`Clip` gains `speed?: ClipSpeed`, in `project` because core modules read it, as with `sound`:

- `rate`: multiplier, 0.1 to 10, default 1.
- `pitchCorrection`: whether speech keeps its pitch, default true.
- `reversed`: default false (stage 3).

Defaults are never stored, so a normal clip has no `speed`. `Clip.duration` stays the length on the
timeline. The part of the file a clip uses is `duration * rate`, rounded to integer `Micros`.

### One function for time

Like `clipPlacement()` for pictures, one pure function in `project` maps timeline time to file time:
`sourceTimeAt(clip, time)`. Nothing else multiplies by a rate. It replaces the `sourceIn + time - start`
in `preview/engine/engine.html.ts`. `preview/logic/frame.ts`, `export/logic/mixdown.ts` and
`export/logic/sources.ts` have the same sum for composition clips, which have no speed, so those stay,
but `mixdown` must map a media clip's `from` and carry the rate.

### What speed changes in existing rules

- **Trim:** `clampTrim` and `trimLimits` measure the room left in the file at the clip's rate. `sourceIn`
  moves by `delta * rate`.
- **Split:** the right half's `sourceIn` moves by `offset * rate`. Both halves keep `speed`.
- **Fit to a composition, `addClip`, placement:** unchanged, because a new clip has no speed.
- **Fades:** stay in timeline time and are clamped to the new duration in the same step, as
  `audio.setSound` does.
- **Linked clips:** the picture and its sound take the same `speed`, as one step.
- **Timeline display:** the clip label shows the speed in `text-mark` when it isn't 1x, for example
  `clip.mp4 2.00x`. Waveforms and filmstrips are decorative today (`ClipBody` never reads `sourceIn`),
  so they need no change. Real ones aren't part of this work.

### `speed.set` and `speed.reset`

A new feature module, `src/modules/speed/`, requiring `project`, `timeline`, `preview`, `inspector`
(rule 7). Tools `speed_set` and `speed_reset`.

- `speed.set`: `{ clipIds, rate?, duration?, pitchCorrection?, ripple? }`, with `rate` or `duration`, not
  both. A `duration` is turned into a rate; it's refused with `speed.out_of_range` if that's outside 0.1
  to 10.
- The part of the file used doesn't change. A new rate changes `duration` to `span / rate`, keeping
  `start`.
- **Ripple on** (the default): what follows on the track moves with the new end, with partners, using
  the same machinery as `rippleTrim`. Junctions shrink as they do for a trim. Anything unlinked in the
  way refuses with `timeline.overlap`.
- **Ripple off:** the rest of the timeline stays put. A slower clip is clamped so it stops at the next
  clip, and the rate returned is the one applied. A faster clip leaves a gap.
- **Ripple off with a junction on the clip's end:** refused with `speed.joined`, because either way the
  transition would change or vanish without being asked. The box and the section show why next to the
  Ripple switch. A junction on the clip's start isn't affected, since `start` doesn't move.
- `ripple` is a command input, not stored on the clip. The box and the section remember the last choice
  in the speed module's per-kernel view.
- Only clips that play a file's time: else `speed.unsupported`. Rate 1 with pitch correction on removes
  `speed` entirely.
- `speed.reset` clears `speed` on the clips and partners, with the same `ripple` input.

### Preview

- `syncSlot` follows `sourceTimeAt`, and each slot's `playbackRate` is set from the clip. The drift
  check (`logic/drift.ts`) needs to stay correct at high and low rates, and the pooled element's rate must
  return to 1 when reused.
- `preservesPitch` follows `pitchCorrection` (or see stage 0).
- During a slider drag, the rate reaches the engine through the existing live channel (`previewProps`
  style) and the clip's width on the timeline changes through the DOM. Release sends one `speed.set`.

### Export

Frames come from the preview engine one at a time, so `sourceTimeAt` covers them. Sound needs work:
`SoundSegment` carries the rate and pitch correction, `from` is in file time, and `src-tauri/src/export/recipe.rs`
adds the tempo step. It reads `duration * rate` of the file and plays it in `duration`, with `atempo`
when pitch correction is on and a resample when it's off. The chain already has an `atempo` helper for
factors outside 0.5 to 2. The clip's own Pitch value still applies on top, and fades apply in timeline
time, so they come after the tempo step. Check the same result in preview by ear.

### The box

A small popover above the clip, anchored with `timeline.clipBox(id)`, opened by Speed... in the menu. It
stays open until a click outside or Escape, so the user can press play and keep adjusting. If the clip
scrolls away it follows it or closes (builder's choice). It holds, top to bottom:

- Title `Clip speed` in `font-hand`, with the `Gauge` icon.
- The kit's slider with its number box, showing `2.00x`.
- Presets as a `SegmentedControl`: 0.25x, 0.5x, 1x, 1.5x, 2x, 4x.
- Duration, as an editable timecode field.
- Ripple timeline and Pitch correction, as `ToggleRow`s.

The slider's scale is logarithmic, so 1x sits in the middle and 0.1x and 10x at the ends. `SliderField`
is linear, so it needs a scale option or a wrapper. Changed values are red (`text-mark`, as the inspector
does with `data-changed`).

The kit's `Popover` needs a trigger today. Anchoring it to a screen box instead is a change to `@/ui`.

### The inspector section

`speed` contributes an `inspectorSections` entry on tab `video`, ordered right after Transform (order
900), with `appliesTo` matching the same clips. It's a normal fold section with a reset action, and shows
Direction, the slider, presets, Duration and the two toggles. Direction (Forward / Reverse, as a
`SegmentedControl`) is only in the inspector, to keep the box small. For a linked picture and sound it
shows once.

### Stage 2: Freeze frame

Runs at the playhead, on a picture on a video track. It splits the clip there and inserts a 3-second
hold of that frame between the halves, moving what follows later on the track, with partners. Linked
sound gets a gap of the same length. The hold is a clip that always shows one frame of the file, stored
with `Clip.speed` (for example a `rate` of 0, or a `frozen` flag, builder's choice) and treated like an
image for length: it trims to any length and has no sound. One undo step. Command `speed.freezeFrame`,
tool `speed_freeze_frame`.

### Stage 3: Reverse

`speed.reversed` plays the used part of the file backwards. `speed.set` gains `reversed`, and
`sourceTimeAt` handles it, so Split swaps which half keeps the later part of the file.

Elements can't play backwards, so reverse needs a reversed copy of the file, made by the Rust side:

- Same rules as proxies (rule 21: one video stream, one audio stream, no timecode or data tracks).
  Export draws from a full-quality reversed master, as it already does for proxies (`prepare_master`).
- FFmpeg's `reverse` filter holds the whole clip in memory, so long files must be reversed in segments
  and joined.
- Made on demand in the background with progress, like a proxy. Until it's ready the clip shows a
  waiting state in preview, and export waits for it. The cache follows the proxy's rules.
- Sound uses `areverse` in the same job.

## Tests

Only what `CLAUDE.md` rule 3 allows: `sourceTimeAt`, trim and split with a rate, `speed.set` with ripple
and junctions, paste placement and link groups, ripple delete, `timeline.linkClips`, the workspace format,
the `atempo` chain in `recipe.rs`. No tests for menus, the box or the section.

## Documentation

Each change updates its module's README in the template: `timeline` (commands, points, Not yet), `audio`
(the Not yet note on speed), `preview`, `export`, `media`, `inspector`, `src/ui`, and a new
`src/modules/speed/README.md`. `CLAUDE.md`'s scope, Where to look and rule 13 get the new module and any
new points. `Clip.duration`'s comment in `project.types.ts` is no longer true.

## Left to the builder

- Keyboard navigation inside the menu.
- How `MenuItem` expresses groups, and how `SliderField` gets its log scale.
- Whether the box follows a scrolling clip or closes.
- Icons for each menu item (the mockup's are a starting point).
- File layout inside the new module, within rules 27 to 30.

## Calls made without the user

- Paste on the empty timeline lands where the right click was; in a clip's menu and with Ctrl+V, at the
  playhead.
- Clipboard is per actor and inside the project only; junctions aren't copied.
- Link audio only undoes an unlink: same file, same timing, same speed.
- Disabled clips apply in preview and export; their junctions stay.
- Ripple delete closes the gap that really opens, only on tracks that lost a clip, and linked clips
  move by the smaller shift so they stay in sync.
- Speed shows as `2.00x`, not `200%`. Range 0.1x to 10x.
- No speed on composition clips.
- Ripple on and Pitch correction on by default.
- Ripple off stops a slowed clip at its neighbour, and is refused on a clip with a transition on its
  end.
- Waveforms and filmstrips stay decorative.
- Freeze frame inserts a 3-second hold and pushes the rest later.
- Reverse is in, on the reading that the user's "yes" kept it.
