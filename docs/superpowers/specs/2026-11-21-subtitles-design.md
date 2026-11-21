# Subtitles: text clips marked as subtitles, edited together on their own page

## Why

Short-form video lives on captions. Today a caption is a text clip, and a video with 200 of them
means styling 200 clips one by one, and reading the words means clicking through the timeline.
The owner wants subtitles that share a look (change it once, every cue follows), a calm place to
type and time them without the rest of the editor in the way, and `.srt` files in and out.

They must not cost the freedom text clips have. In short-form edits a caption sits behind the
person (a matte), a sticker pops over a word, one line is bolder or red for intensity. So a
subtitle is **not** a new kind of thing: it is an ordinary text clip with a **subtitle mark**. The
mark adds the shared style and puts the clip on the Subtitles page; everything else a text clip
can do (keys, motion path, masks, blend, depth, transform) keeps working while it is a subtitle.

No speech recognition: v1 has no AI features. Automatic transcription (local Whisper) is a later
step whose output will be exactly these marked clips.

## Goals

- **Mark / unmark.** Any text clip, on any video track, can be marked as a subtitle. "Remove from
  subtitles" drops the mark and keeps the clip looking exactly as it did, as a free text clip.
- **Named styles per composition** (`Default`, `Intense`, `Whisper`, …). Each cue uses one. Editing
  a style restyles every cue that uses it, in one undo step.
- **Per-cue overrides.** Changing a value on one cue stores only that value on the cue; the rest
  still follows its style. The inspector shows which values are overridden and resets them to the
  style.
- **A Subtitles page** (beside Tint and Sound): cue list, the real preview, the style panel, and a
  timeline that lists only the subtitle cues.
- **Typing flow** in the cue list: edit words in place, Enter splits, Backspace at the start
  merges, a row click seeks, the cue under the playhead is highlighted.
- **Import `.srt` and `.vtt`** into a new track at the top. **Export `.srt`** of a composition's
  cues. Burned-in subtitles need nothing: cues are text clips, so export draws them.
- Everything a user can do, an agent can do (MCP), undoable.

## Non-goals (this version)

- Per-word styling or highlighting inside one cue (karaoke). Needs styled spans in the text
  layout; a later step.
- Languages (a language on the mark, one `.srt` per language).
- Automatic transcription, auto line-wrapping, reading-speed warnings.
- `.vtt` / `.ass` export, embedded subtitle streams in the exported file.
- A special track kind. Tracks stay `video` / `audio`.

## Anti-goals

- A subtitle that can do less than a text clip. If an effect works on a text clip, it works on a
  cue.
- Retyping. Marking, unmarking, changing a style or importing never loses words or a look the user
  set by hand.
- A second text renderer. Cues are drawn, measured, hit-tested and exported by the `text` element.

## Approaches considered

1. **A new `subtitle` track kind.** Clear lane, but about 100 checks of `track.kind` across ~40
   files (11 in the preview engine) would need a third case; a missed one means cues that don't
   draw or export. Rejected.
2. **A video track flagged "subtitle".** No engine work, but it pins subtitles to their own lanes,
   so a caption can't sit between a person and their cut-out without moving the whole track, and a
   text clip can't become a subtitle where it is. Rejected by the owner in favour of 3.
3. **A mark on the clip (chosen).** Tracks stay normal; any text clip anywhere can be a subtitle;
   the page collects them. A style's values are written into its cues (below), so nothing outside
   the module changes.

Everything-in-the-Editor (a cue list panel in the editor) was rejected for clutter: the owner wants
the editor clean and the subtitle work on its own page.

## Design

### Data (project module)

- `Clip.subtitle?: { styleId: SubtitleStyleId }`: the mark. Text clips only. A plain clip field
  like `matte`, not a shared group: it changes only through subtitle commands.
- `ProjectState.subtitleStyles?: Record<SubtitleStyleId, SubtitleStyle>`, each
  `{ id, compositionId, name, color, props, position }` (`color` is a marker color, for its dot and the badge):
  - `props`: text element values (the same fields as a text clip's `props`: font, size, weight,
    fill, outline, background, shadow, align, spacing, uppercase). Stored whole, not minimized, so
    a style reads on its own.
  - `position`: `{ x, y }` in output pixels from the frame's center, the base of the cue's
    `transform.x` / `transform.y`.
  - Per composition, because sizes and positions are output pixels and a 9:16 and a 16:9
    composition need different ones (like markers and motion paths, which also belong to one
    composition).
- `Composition.subtitleStyleOrder?: SubtitleStyleId[]`. The first is the composition's default
  style; it can be renamed and edited but not removed while it is the only one.
- Styles are created when needed: the first mark or import in a composition creates `Default` (the
  Classic preset) in the same command. New styles start from a preset (**Classic**: bottom center,
  2 lines, white on soft shadow; **Punchy**: big, centered, bold, outline; **Intense**: Punchy in a
  strong color) or as a copy of another style.
- The project file goes to version 7. No compatibility work: the app isn't released, so older
  files and older apps need no special handling.

### How a cue follows its style: written into the cue

A cue stores its whole look like any text clip: the style's values are **written into the cue**
(`props`, `transform.x` / `transform.y`). Nothing outside `subtitle` changes: the engine, export
(which renders a snapshot of the document), the canvas tools, the in-place editor, the inspector
and keyframes all keep reading the clip as they do today.

- **An override is a value that differs from its style.** No list of overrides is stored: a cue's
  `font` is its own exactly when it isn't the style's `font`. Setting it back to the style's value
  makes it follow again. The inspector, the cue list's ◆ and the Cue tab all use this one rule
  (`logic/overrides.ts`, pure).
- **Changing a style** (`subtitle.updateStyle`) writes the new values into every cue of that style
  **whose value equals the style's old value**, in the same command, so it is one undo step. A
  cue that differed keeps its own value. A field keyed on the cue (a key track at that path) is
  skipped: its keys win.
- **Position works the same way.** A cue moved on the canvas no longer sits at the style's position,
  so it keeps its place when the style's position changes.
- **Reset to style** (`subtitle.resetToStyle`, `clipIds`, optional `paths`) writes the style's values
  into the cue.
- Resizing a composition with "scale" scales its styles' positions with the clips (the composition
  settings command already scales the composition's motion paths the same way), so cues that
  followed their style still follow it.
- Rejected: a live layer in `element` (values resolved as defaults ⊕ style ⊕ clip). Positions don't
  go through `ElementApi.resolve` (`clipTransform`, about 11 callers in 8 modules), `textStyleOf`
  merges by hand, and export renders a snapshot, so the layer would need the state passed through
  every caller. Writing values into the cue gives the same behaviour with no change outside the
  module.

### Marking and unmarking (subtitle module)

- **Mark** (`subtitle.mark`, `clipIds`, optional `styleId`): text clips only
  (`subtitle.not_text`). **The clip takes the style** (the owner's choice): the style's values are
  written over its look (`props` other than `text`, and `transform.x` / `transform.y`); words, other
  transform values, keys, masks, matte, blend and timing stay. Undo brings the old look back, and
  **New style from this cue** (`subtitle.addStyle` with `fromClipId`) turns a look the user likes
  into a style first. Changing a marked clip's style (`subtitle.mark` again with another `styleId`)
  writes the new style over the values that followed the old one and keeps its own values.
- **Unmark** (`subtitle.unmark`, `clipIds`): drops the mark. The look is already stored in the clip,
  so it looks the same afterwards and nothing else is written.
- A marked clip that ends up in another composition (paste, grouping, duplicating a composition)
  takes a copy of its style into that composition, made by the project's integrity pass after every
  edit, so no command copies styles itself. A mark whose style is gone is dropped; the clip keeps
  its look.
- Marks survive split and freeze too (both copy clip fields one by one, so they copy the mark).

### Styles (subtitle module)

`subtitle.addStyle` (composition, name, and one of a preset, `fromStyleId` or `fromClipId`), `subtitle.updateStyle`
(`styleId`, a patch of `props` / `position`, validated with the text element's patch schema),
`subtitle.renameStyle`, `subtitle.removeStyle` (its cues move to the default style, in the same
undo step), `subtitle.reorderStyles`. A slider gesture on a style sends one `updateStyle` on
release; while dragging, the page previews live the way the inspector does today.

### Cues (subtitle module)

- `subtitle.addCue` (composition, optional track, `start`, `duration`, `text`, `styleId?`): a
  marked text clip. Without a track: the track of the cue before the playhead, else a new top
  track named "Subtitles". Fails if it would overlap a clip on that track.
- `subtitle.splitCue` (`clipId`, `at` character index): splits the clip (nested `timeline.splitAt`)
  at a time proportional to the characters before `at`, then sets each half's words. My call:
  proportional, because the caret position has no time of its own; the user nudges after.
- `subtitle.mergeCues` (two cues adjacent on one track): one clip spanning both, words joined with a
  space, the first cue's overrides kept.
- Moving, trimming and deleting cues are the timeline's existing commands.

### Import and export

- `subtitle.import` (composition, `text`, `format` `srt` | `vtt`, optional `styleId`): parses in
  `logic/` (pure), creates one new video track at the top of the composition named after the file
  ("Subtitles" for an agent), and adds every cue as a marked text clip. Line breaks in the file are
  kept; nothing is wrapped (the Classic preset's "two lines" means it is sized for two lines). Overlapping cues in the file
  go to a second new track rather than being dropped. A file with no cue fails
  (`subtitle.empty_file`); a malformed block is skipped and counted in the result.
- The UI picks the file (dialog) and reads it, then runs the command with the text. An agent passes
  the text itself. Reading and writing go through a small `src-tauri/src/subtitle/` module with
  `subtitle_read_text` / `subtitle_write_text` for `.srt` / `.vtt` paths only: the fs plugin's scope
  covers only the fonts folder, and the workspace's commands accept `.cclip` paths only
  (`src-tauri/src/workspace/commands.rs`).
- Export `.srt`: a pure `toSrt(state, compositionId)` (every marked cue sorted by start, words
  as they are, disabled clips skipped). The page's Export button saves it with a dialog; the
  `subtitle_to_srt` MCP tool returns the text. Not a command: it changes nothing.

### The Subtitles page

A page contributed to `appPages` (after Sound), built like the Sound page.

```
┌ cue list ───────────┬ preview ─────────────────┬ Style │ Cue ──────┐
│ ▸ 00:01.20 Hola,   ●│                          │ ● Default (42)    │
│   00:03.80 hoy vam… │      [ real frame ]      │ ○ Intense (3)     │
│   00:06.10 ¡NO PUE◆ │                          │ + New style       │
│ + Add cue           │                          │ font, size, fill… │
│ Import  Export .srt │                          │                   │
├─────────────────────┴──────────────────────────┴───────────────────┤
│ timeline, subtitle scope: only tracks holding cues, only cues       │
└─────────────────────────────────────────────────────────────────────┘
```

- **Cue list** (virtualized: hundreds of rows): start time, words (edited in place), a dot in the
  style's color, a mark when the cue has overrides. Enter splits at the caret, Shift+Enter adds a
  line, Backspace at the start merges with the cue before on the same track, Up / Down move between
  rows, a click seeks to the cue's start. The row under the playhead is highlighted without React
  renders per frame (rule 24). Editing the words of a row sends one `element.setProps` on commit.
- **Preview**: the same `PreviewStage` the Sound page uses, so a cue behind a person or under a
  sticker shows as it will export. **No canvas tools on this page** (the owner's choice): `bare`,
  as on the Sound page. A click on a cue in the frame selects it, a double-click puts the cursor in
  its row. Moving, scaling and every other canvas tool stay in Edit.
- **Style tab**: the composition's styles (name, color dot, how many cues use it), add / rename /
  remove / reorder, and the selected style's values in the text element's own sections (Font,
  Fill, Outline, Background, Shadow, plus Position), so a style has exactly the fields a text clip
  has. A group with a switch in its header (Outline, Background, Shadow) shows its fields
  **disabled while the switch is off**, as the inspector does today. Reusing the inspector's
  controls for values that belong to a style, not a clip, is the main UI question for the builder.
- **Cue tab**: the selected cues' style picker and the same sections, values that are the cue's
  own marked, each with "Reset to style", plus "Reset all to style", "New style from this cue" and
  "Remove from subtitles". Several selected cues are edited together. Disabled fields follow the
  group switches as in the Style tab.
- **Timeline**: `TimelinePanel` with a new `"subtitle"` scope: lists video tracks holding at least
  one cue and draws only the cues on them (other clips aren't shown or editable there). Cues on two
  tracks overlapping in time show as two lanes, so the conflict is visible.
  - Above them, two thin faded rows for timing only: **Picture** (the composition's picture clips,
    so the cuts show) and **Sound** (the mixed waveform, where the speech is). They can't be
    selected or edited; a click there only moves the playhead. The cuts also show as faint lines
    through the cue lanes.
  - A cue's body drags to move, its edges trim. Moves and trims snap to cuts, other cues' edges and
    the playhead (the timeline's snapping, with the cuts as a snap target).
  - Clicking a cue selects it without moving the playhead (so "pause at the end of the phrase,
    select the cue, press `]`" works).
- **Times in the cue list**: each row shows start, end and length. Dragging one sideways nudges it
  (a frame every few pixels); clicking it opens a field to type (`0:04.20` or `4.2`). A cue stays
  between its neighbours on its track and at least 0.2 s long; a value that had to be clamped says
  so.
- **Timing keys** (a cue selected, not typing in the words): `[` / `]` set its start / end to the
  playhead; `Alt+←` / `Alt+→` nudge the last edge touched by one frame, with `Shift` the whole cue.
  Every one of these, a drag, a typed time, is one undo step through the timeline's trim and move
  commands.

### In the editor

- A marked clip looks like a text clip plus a small subtitle badge (a `clipActions` badge).
- Its clip menu offers **Subtitle style ▸** (the composition's styles) and **Remove from
  subtitles**; a text clip without a mark offers **Mark as subtitle**.
- The inspector's Text panel for a marked clip shows which values are overridden and resets one
  to the style (a `fieldActions` contribution).

### MCP

`subtitle_mark`, `subtitle_unmark`, `subtitle_add_style`, `subtitle_update_style`,
`subtitle_rename_style`, `subtitle_remove_style`, `subtitle_reorder_styles`,
`subtitle_reset_to_style`, `subtitle_add_cue`,
`subtitle_split_cue`, `subtitle_merge_cues`, `subtitle_import` (all `commandTool`), and
`subtitle_to_srt` (read-only). `project_get_state` shows marks and styles.

## Constraints

- All the rules in `CLAUDE.md`. The module is a **feature**, `src/modules/subtitle/`, listed in
  `bootstrap.ts`; requires at least `project`, `element`, `text`, `timeline`, `preview`,
  `inspector`.
- `CLAUDE.md`'s v1 scope gains "subtitles marked on text clips, with styles, the Subtitles page and
  `.srt` in and out"; its module list gains `subtitle`.
- Times are `Micros`; `.srt` times are rounded to milliseconds on export, read exactly on import.

## Calls made after the review (check these)

- **Scope of the page:** the cue list, the page timeline and `.srt` export cover the cues directly
  on the open composition. Cues grouped into a nested composition stay marked and show when that
  composition is opened (its tab), but the outer one's list and `.srt` don't include them.
- **The page timeline (`"subtitle"` scope)** opts in: move, trim, Split, Delete, marker flags, the
  collaborators' playheads. Not: transition chips, the key dock, speed, transform, copy and paste.
  The page sets `keepsPlayback`; Space and the timeline keys do nothing while typing in the cue
  list (a text field has focus).

## Left to the builder

- The full list of places that copy clip fields selectively (so the mark survives).
- How the Style tab reuses the inspector's section layout and controls for a style's values.
- How the `"subtitle"` scope filters clips inside `TimelinePanel` (today scopes filter by track).
- Adding `subtitle` and `subtitleStyles` to the project file's schema (strict where the rest is).
- Virtualizing the cue list (the timeline's and the font list's approaches exist).
