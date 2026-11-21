# subtitle

Subtitles are text clips marked as cues of a **style**: a named look (text values and a position)
that belongs to one composition. The style's values are written into each cue, so a cue reads,
draws and exports like any text clip; nothing outside this module changes. A cue's **own** value is
simply one that differs from its style (no list of overrides is stored): changing a style rewrites
the cues that still had its old value, and a cue that differed keeps its own. Keyed fields are never
written: their keys win.

- **Tier:** feature
- **Requires:** `project`, `element`, `text`, `fonts`, `timeline`, `preview`, `media`, `transform`, `inspector`
- **Contributes:** the page `subtitle` (`SUBTITLE_PAGE`; `appPages`, "Subtitles", icon `Captions`,
  order 22, after Edit and before Tint and Sound, `keepsPlayback: true`, `timelineScope:
"subtitle"`); the timeline overlay `subtitle.context` (`timelineOverlays`, scope `subtitle`: the
  context band); the timing keys (`keybindings`, below); in the editor, the badge
  `subtitle.badge` and the menu `subtitle.clip` (`clipActions`, below) and the field action
  `subtitle.own` (`fieldActions`).
- **Points it owns:** none
- **API** (`useModule(subtitleRef)` / `ctx.require(subtitleRef)`): `view`, the page's view state
  (`SubtitleViewState`, `subtitle.store.ts`): `edge` (the edge the timing keys nudge, set by
  touching a time), `tab` and `styleId` (the side panel's), `focus` (a row to put the cursor in,
  at `caret`, the end or around all its words; the cue list scrolls to it and clears it).
- **Files:**
  - `logic/presets.ts`: Classic (the first style, `Default`), Punchy, Intense, Whisper, sized as
    fractions of the short side over the default text style; `position.y` as a fraction of height.
  - `logic/overrides.ts`: `styleLeaves` (a style's values by path, `font` whole, groups one level
    deep, `transform.x` / `transform.y`), `ownPaths` (where a cue differs), `restylePatch` (the
    nested patch moving a cue from one style to another).
  - `subtitle.write.ts`: making and storing styles (props stored as a cue stores them, through
    `normalizeTextStyle`; colors cycle from blue), and `restyle`, one nested `element.setProps` per
    cue.
  - `subtitle.style.commands.ts`, `subtitle.mark.commands.ts`, `subtitle.guards.ts`,
    `subtitle.mcp.ts`.
  - `subtitle.cue.commands.ts` (add, split, merge), `subtitle.import.command.ts`,
    `logic/srt.ts` (`parseSubtitles`, `toSrt`), `logic/lanes.ts` (`laneOf`, greedy lanes for
    overlapping cues), `subtitle.service.ts` (file dialogs and `subtitle_read_text` /
    `subtitle_write_text` in `src-tauri/src/subtitle/`: absolute `.srt` / `.vtt` paths, 8 MB).
  - `logic/time.ts` (`parseTime`: seconds or `m:ss.cc`; `clampCue`: between the neighbours and at
    least `MIN_CUE` = 0.2 s), `subtitle.timing.ts` (`cueTimeAction`: the `timeline.trimClip` /
    `timeline.moveClip` that sets one time of a cue, clamped), `subtitle.keys.ts`.
  - `logic/context.ts`: `pictureCuts` (edges of the enabled picture clips that aren't cues, each
    once), `pictureSpans` (the stretches between two cuts that show a picture), `soundLine` (the
    loudest peak per column of the enabled clips on unmuted audio tracks, through `sourceIn` and
    speed).
  - `ui/`: `SubtitlePage`, `SubtitleTransport`, `CueList` (+ `now.row.hook.ts`), `CueRow` (+
    `cue.edit.hook.ts`), `TimeField`, `SubtitleStage` (+ `CuePicker`), `ContextBand` (+
    `SoundRow`, `timeline.window.hook.ts`), `subtitle.files.ts` (Import and Export). Failures are told with `report` (`@/core`).
  - Side panel: `SubtitleSide` (tabs), `StyleTab` (+ `StyleList`, `NewStyleMenu`, `StyleEditor`,
    `style.live.hook.ts`), `CueTab` (+ `cues.live.hook.ts`), `style.source.ts` (the panels'
    property trees), `styles.hook.ts` (the open composition's styles).
  - Editor: `CueBadge`, `OwnValueAction`, `subtitle.menu.ts`.

The data (`SubtitleStyle`, `Clip.subtitle`, `Composition.subtitleStyleOrder`) lives in `project`,
whose integrity pass copies a style along with a cue that lands in another composition and drops a
mark whose style is gone. The first mark or `addStyle` in a composition without styles creates
`Default` (Classic) in the same command.

| Command                  | MCP tool                  | Notes                                                                                                                              |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `subtitle.addStyle`      | `subtitle_add_style`      | one of `preset` (default `classic`), `fromStyleId`, `fromClipId`; Classic unnamed with no style yet is just Default; `{ styleId }` |
| `subtitle.updateStyle`   | `subtitle_update_style`   | `props` patch and/or `position`; stored normalized; rewrites cues that followed; returns `{ restyled }`                            |
| `subtitle.renameStyle`   | `subtitle_rename_style`   | 1–60 characters                                                                                                                    |
| `subtitle.removeStyle`   | `subtitle_remove_style`   | cues move to the default style (follow rule); fails `subtitle.last_style`; returns `{ moved }`                                     |
| `subtitle.reorderStyles` | `subtitle_reorder_styles` | every style of the composition once; the first is the default                                                                      |
| `subtitle.mark`          | `subtitle_mark`           | text clips only; writes the style over the look (words, keys, masks stay); re-marking keeps own values; `{ marked }`               |
| `subtitle.unmark`        | `subtitle_unmark`         | drops the mark; the look stays; fails `subtitle.not_marked`                                                                        |
| `subtitle.resetToStyle`  | `subtitle_reset_to_style` | writes the style's values into cues: all, or `paths`                                                                               |
| `subtitle.addCue`        | `subtitle_add_cue`        | on `trackId`, else the track of the cue before, else a new top track "Subtitles"; marked; `{ clipId }`                             |
| `subtitle.splitCue`      | `subtitle_split_cue`      | `at` = character index; cut at the same share of time, on a frame; `text` = typed words; `{ clipIds }`                             |
| `subtitle.mergeCues`     | `subtitle_merge_cues`     | two cues end to end on one track (±1 µs); words joined with a space, or `text`; `{ clipId }`                                       |
| `subtitle.import`        | `subtitle_import`         | `.srt` / `.vtt` text; one new top track per lane of overlapping cues; `{ clipIds, trackIds, skipped }`                             |
|                          | `subtitle_to_srt`         | read only: `.srt` of the marked, enabled cues of a composition                                                                     |

Failures: `subtitle.clip_not_found`, `subtitle.not_text`, `subtitle.not_marked`,
`subtitle.style_not_found`, `subtitle.last_style`, `subtitle.composition_not_found`,
`subtitle.invalid_style`, `subtitle.overlap`, `subtitle.split_outside`, `subtitle.not_adjacent`,
`subtitle.empty_file`.

## The Subtitles page

- **Transport:** the time, To start, Play; Add cue (2 s of "New cue" at the playhead, by
  `subtitle.addCue`, its words selected), Import .srt / .vtt (`pickSubtitleFile` →
  `readSubtitleFile` → `subtitle.import`, the tracks named after the file), Export .srt (`toSrt` →
  `saveSrt`, named after the composition); the number of cues; Undo. Results and failures are
  toasts (`notify`).
- **Cue list:** every cue of the open composition (`cuesOf`: by start, then track order) as rows of
  64 px, drawn only near the view (`visibleWindow`). A row: start, end and length with the track
  (`TimeField`), the words in a `<textarea>`, the style's dot (`MARKER_HEX`) and ◆ when `ownPaths`
  is not empty. A click selects the cue (the timeline's selection) and seeks to its start, Ctrl
  adds or removes one, Shift takes the range; the side tab turns to Cue. The row under the playhead
  gets `data-now` from `playback.onTime`, written on the DOM. In the words: focus selects and seeks;
  Enter splits at the caret (`subtitle.splitCue` with the typed words); Shift+Enter a new line;
  Backspace at the start merges with the cue ending where it starts on the same track
  (`subtitle.mergeCues`, the typed words); Up at the start and Down at the end go to the row
  before or after; Esc leaves; the words are written on blur (one `element.setProps`).
- **Times:** drag one sideways to nudge it a frame (the composition's `frameDuration`) every 4 px,
  shown live on the DOM, one `timeline.trimClip` (start, end, length) on release; click to type
  (`parseTime`). Kept between the neighbours on its track (`neighbourBounds`) and at least 0.2 s
  long; a value that had to be clamped says so. Touching start sets `view.edge` to `start`, end or
  length to `end`.
- **Keys** (this page, one cue selected, not typing): `[` / `]` its start / end at the playhead;
  Alt+Left / Alt+Right move `view.edge` by one frame; with Shift the whole cue
  (`timeline.moveClip`). Clamped like the times.
- **Stage:** `PreviewStage bare` with a layer over the frame (`CuePicker`): a click selects the
  top-most cue under the pointer (`useVisibleLayers`, `clipPlacement`, `topmostAt`), a
  double-click puts the cursor at the end of its row.
- **Context band** (`ContextBand`, sticky under the ruler in the `CONTEXT_HEIGHT` room the panel
  leaves): a Picture row (`pictureSpans`) and a Sound row (`SoundRow`: a canvas the width of the
  view, sticking after the headers, redrawn on scroll, zoom, project changes, resize and
  `media.onPeaks`; peaks are asked once per file for clips in view only), both at half opacity; a
  press scrubs the playhead (`useScrubDrag`). The cuts are faint dashed lines through the cue
  lanes. Only the page in view and one each side are drawn. Cues snap to cuts already (every
  clip edge is a snap candidate).

## The side panel

Tabs **Style | Cue** (`view.tab`).

- **Style:** the composition's styles (`StyleList`: color dot, name, cue count, the first marked
  "default"; a click selects into `view.styleId`, a double-click renames (`subtitle.renameStyle`),
  a drag reorders (`subtitle.reorderStyles`)); **New style** (a menu: the four presets, Copy of the
  style shown; `subtitle.addStyle`, then shown) and **Remove** (`subtitle.removeStyle`, off with
  one style). Then the style's values in a `PropertyPanel` (`inspector`) over `styleSource`: the
  text element's properties and sections without the words, plus a Position group (x / y), values
  `{ ...style.props, position }`. A drag shows on every cue that follows (`useStyleLive`:
  `restylePatch` per cue through `PreviewApi.previewProps`, own and keyed values left as they
  are); the release runs one `subtitle.updateStyle`.
- **Cue:** the selected cues (the timeline's selection, marked ones): a Style picker
  (`subtitle.mark` with `styleId`), their look over `cueSource` (the first cue's values; a drag
  shows on all, the release is one `element.setProps` on all, `useCuesLive`), **Reset all to
  style** (`subtitle.resetToStyle`), **New style from this cue** (`subtitle.addStyle`
  `fromClipId`, then shown in the Style tab), **Remove from subtitles** (`subtitle.unmark`).
- **Own values:** the field action `subtitle.own` shows, on a marked clip's row whose paths are
  among `ownPaths` (keyed ones aside), ◆ and Reset to style (`subtitle.resetToStyle` with those
  paths, on every selected cue when the clip is one of them). It shows in the Cue tab and in the
  editor's inspector.

## In the editor

- `CueBadge`: "CC" in the style's color at the bottom right of a marked clip (editor scope only).
- The clip menu (`subtitle.menu.ts`, scopes `all` and `subtitle`), on text clips, acting on the
  selected text clips alike: **Mark as subtitle** (unmarked), or **Subtitle style ▸** (the
  composition's styles, ✓ on the cue's) and **Remove from subtitles** (marked).
