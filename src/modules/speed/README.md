# speed

How fast a clip plays its file: one constant speed, backwards or forwards, and frames held still. The value is `Clip.speed` in `project`, since core modules read it; this module owns the commands, tools, the box over the clip and the inspector section.

- **Tier:** feature
- **Requires:** `project`, `junction`, `timeline`, `preview`, `inspector`
- **Contributes:** `clipActions` (Speed..., Freeze frame), `appOverlays` (`speed.box`), `inspectorSections` (`speed.section`, tab `video`, right after Transform)
- **Points it owns:** —
- **API** (`useModule(speedRef)`): `view` (`boxClipId`, `ripple`: per kernel and never in history)
- **Files:**
  - `speed.commands.ts`: the commands below. `logic/retime.ts`: `retime` (the new layout at a rate), `writeSpeed` (never stores the defaults).
  - `speed.menu.ts`: the menu entries. `logic/timecode.ts`: `parseTimecode`.
  - `ui/`: `SpeedFields` (the same fields in both places, so they always agree), `SpeedBox`, `SpeedSection` (adds Direction), `TimecodeField`, `speed.edit.hook.ts` (drag steps reach the preview through `previewProps` and the clip's width through the DOM; the release is one `speed.set`).
- **Invariants:** only clips that play a file have a speed (`canChangeSpeed`), not text, images, stickers, solids or composition clips. A clip keeps its start and its part of the file, so its length changes. Linked clips take the same speed. A speed equal to the defaults is never stored, so a normal clip has no `speed`. `sourceTimeAt` in `project` is the only place a rate meets clip time.
- **Ripple:** on, what follows on the track moves with the clip's end, with partners, and junctions shrink as for a trim; anything unlinked in the way refuses with `timeline.overlap`. Off, nothing else moves: a slower clip stops at the next one and the rate returned is the one applied, and a junction on the clip's end refuses with `speed.joined`, so a transition never changes unasked.
- **Pitch correction:** WebKitGTK keeps the pitch at any rate and ignores `preservesPitch`, so correction on needs nothing and off runs the pitch worklet at the rate (see `docs/superpowers/specs/2026-11-02-speed-preview-check.md`). Export uses `atempo`, or `asetrate` when off.
- **Freeze frame:** a hold is a clip at `rate: 0`: one frame of the file, no time of its own (`followsFileTime` is false), so it trims to any length and has no sound.
- **Reverse:** elements only play forwards, so a reversed clip plays a copy of its file that runs backwards, made by the native side in pieces (`src-tauri/src/media/reversed.rs`) and asked for through `media.reversedUrl`. `sourceTimeAt` stays in the original file's time; `elementTimeAt` mirrors it for the copy. Export draws from a full-quality copy, and reverses sound with `areverse`.

| Command             | MCP tool             | Notes                                                                   |
| ------------------- | -------------------- | ----------------------------------------------------------------------- |
| `speed.set`         | `speed_set`          | `rate` or `duration`, `pitchCorrection`, `reversed`, `ripple`           |
| `speed.reset`       | `speed_reset`        | Back to normal speed, forwards, with pitch correction                   |
| `speed.freezeFrame` | `speed_freeze_frame` | Splits and puts in a 3 s hold, moving what follows. `speed.unsupported` |

Fails with `speed.unsupported`, `speed.out_of_range`, `speed.joined`, `speed.clip_not_found` and `timeline.overlap`.

**Not yet:** speed ramps and keyframes, and speed on composition clips. Very high speeds may drop frames in preview, not in export. Windows (WebView2) hasn't been checked.
