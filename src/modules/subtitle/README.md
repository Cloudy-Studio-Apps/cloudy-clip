# subtitle

Subtitles are text clips marked as cues of a **style**: a named look (text values and a position)
that belongs to one composition. The style's values are written into each cue, so a cue reads,
draws and exports like any text clip; nothing outside this module changes. A cue's **own** value is
simply one that differs from its style (no list of overrides is stored): changing a style rewrites
the cues that still had its old value, and a cue that differed keeps its own. Keyed fields are never
written: their keys win.

- **Tier:** feature
- **Requires:** `project`, `element`, `text`, `fonts`, `timeline`
- **Contributes:** nothing yet (the page and panels come later)
- **Points it owns:** none
- **API** (`useModule(subtitleRef)` / `ctx.require(subtitleRef)`): empty
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
- **Not yet:** the Subtitles page and its panels.

The data (`SubtitleStyle`, `Clip.subtitle`, `Composition.subtitleStyleOrder`) lives in `project`,
whose integrity pass copies a style along with a cue that lands in another composition and drops a
mark whose style is gone. The first mark or `addStyle` in a composition without styles creates
`Default` (Classic) in the same command.

| Command                  | MCP tool                  | Notes                                                                                                                |
| ------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `subtitle.addStyle`      | `subtitle_add_style`      | one of `preset` (default `classic`), `fromStyleId`, `fromClipId`; returns `{ styleId }`                              |
| `subtitle.updateStyle`   | `subtitle_update_style`   | `props` patch and/or `position`; stored normalized; rewrites cues that followed; returns `{ restyled }`              |
| `subtitle.renameStyle`   | `subtitle_rename_style`   | 1–60 characters                                                                                                      |
| `subtitle.removeStyle`   | `subtitle_remove_style`   | cues move to the default style (follow rule); fails `subtitle.last_style`; returns `{ moved }`                       |
| `subtitle.reorderStyles` | `subtitle_reorder_styles` | every style of the composition once; the first is the default                                                        |
| `subtitle.mark`          | `subtitle_mark`           | text clips only; writes the style over the look (words, keys, masks stay); re-marking keeps own values; `{ marked }` |
| `subtitle.unmark`        | `subtitle_unmark`         | drops the mark; the look stays; fails `subtitle.not_marked`                                                          |
| `subtitle.resetToStyle`  | `subtitle_reset_to_style` | writes the style's values into cues: all, or `paths`                                                                 |
| `subtitle.addCue`        | `subtitle_add_cue`        | on `trackId`, else the track of the cue before, else a new top track "Subtitles"; marked; `{ clipId }`               |
| `subtitle.splitCue`      | `subtitle_split_cue`      | `at` = character index; cut at the same share of time, on a frame; `text` = typed words; `{ clipIds }`               |
| `subtitle.mergeCues`     | `subtitle_merge_cues`     | two cues end to end on one track (±1 µs); words joined with a space, or `text`; `{ clipId }`                         |
| `subtitle.import`        | `subtitle_import`         | `.srt` / `.vtt` text; one new top track per lane of overlapping cues; `{ clipIds, trackIds, skipped }`               |
|                          | `subtitle_to_srt`         | read only: `.srt` of the marked, enabled cues of a composition                                                       |

Failures: `subtitle.clip_not_found`, `subtitle.not_text`, `subtitle.not_marked`,
`subtitle.style_not_found`, `subtitle.last_style`, `subtitle.composition_not_found`,
`subtitle.invalid_style`, `subtitle.overlap`, `subtitle.split_outside`, `subtitle.not_adjacent`,
`subtitle.empty_file`.
