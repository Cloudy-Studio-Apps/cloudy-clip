# export

Turns a composition into a file. The Export page, the last tab of the top bar, sets what to make; exports wait in a queue and run one at a time while you keep editing.

The settings sections fold one by one, and all open again when you come back to the page.

- **Tier:** feature
- **Requires:** `project`, `media`, `preview`, `workspace` (the default file name)
- **Contributes:** page `export.page` (`appPages`, group `PAGE_GROUP_DELIVER`, icon `Upload`)
- **API** (`useModule(exportRef)` / `ctx.require(exportRef)`): `queue`, `form`, `capabilities`, `runner`
- **Files:**
  - Speed: frames come from the preview engine, which follows `sourceTimeAt`. Sound carries `speed`, `keepPitch` and `reversed` to `src-tauri/src/export/recipe.rs`, which reads `duration * speed` of the file and adds `areverse`, then `atempo` (or `asetrate` when `keepPitch` is false) before the clip's own settings. Reversed clips get a full-quality copy before rendering (`media.prepareReversed`). A ramped clip's sound starts at `sourceTimeAt(clip, start)` and carries `tempoSteps` instead of `speed`: one per 250 ms of timeline time (rounded, the last one taking what is left, so their lengths add up to the segment's), each with its `from` in the file and the `speed` that plays its part of the file in its time. `recipe.rs` splits the input (`asplit`); each step reads its part with `atrim` (in samples, 100 ms further, since `atempo` gives a few milliseconds more or less), `asetpts`, its tempo (or `asetrate` when `keepPitch` is false), and is cut to its exact length (`apad`, `atrim`), every step but the last 5 ms longer. Neighbours are joined by `acrossfade` over those 5 ms with `hsin` (gains that add up to 1, as both sides hold nearly the same sound), one pair at a time (more inputs need FFmpeg 7.1), so the next step fades in from its own start: no jump at a boundary, each step stays on the picture and the segment keeps its length. All of this comes before the clip's own settings, envelopes and fades. Labels carry the segment's number and the step's.
  - `export.commands.ts`: `enqueue` checks everything and keeps the document as it is, so later edits don't reach a queued export.
  - `export.runner.ts`: one job at a time, outside the bus. A file with a proxy gets its master first (`media.prepareMaster`), the webview's video levels are measured once (`preview.measureVideoLevels`), then each frame is drawn by `preview.createRenderer` and posted to FFmpeg, which sets the pace.
  - `logic/mixdown.ts`: what sounds in a stretch of a composition, at any depth, as stretches of the original files, with their speed or tempo steps. Muted tracks and disabled clips are left out; clips under a junction get equal-power fades.
  - Keyed volume and pan: `logic/envelope.ts` samples a value every 100 ms (coarser past 25 s, at most 256 points, straight-line points dropped) as `gainEnvelope` / `panEnvelope`, `at` counted from the segment's start, read with `trackValue(track, contentTime(clip, time))`. They replace `gain` and `pan`; the parent placement's gain and a crossfade still multiply in. `recipe.rs` turns them into `volume=eval=frame` expressions of `t`: gain where the gain goes, and a pan through four gains (`pan_gains`, the law of the still `pan_filter`) between `channelsplit` and `join`, before the fades. Expressions are balanced trees of `if` (FFmpeg stops parsing at 100 levels of nesting), constant stretches collapse. A graph over 8 KB goes in `<partial>.filter` (Windows allows about 32 KB for a whole command line) and is read with `-/filter_complex` (FFmpeg 7+) or `-filter_complex_script` (older; `ffmpeg -version` decides); the file is removed on success, failure, cancel and by the start-up sweep.
  - `logic/timing.ts`: a frame is drawn 1 ms into its time. A time rounded to microseconds can fall just before its frame, and a seek there lands on the previous one.
  - `logic/presets.ts`: kinds, formats and the 10–100 quality scale as encoder numbers. `logic/estimate.ts`: rough size and time.
  - `export.guards.ts`: what `enqueue` refuses, and where the file goes.
  - `export.service.ts`: the native calls. `ui/`: the page.
  - Native (`src-tauri/src/export`): `recipe.rs` turns a structured spec into FFmpeg arguments, `job.rs` runs one FFmpeg on `<name>.partial.<ext>` and renames it when complete, `frames.rs` takes frames as raw RGBA over loopback HTTP (a frame is too big for the JSON path IPC takes on Linux), `encoders.rs` says what this FFmpeg can write and which graphics card encoder really works. Quitting doesn't stop a running FFmpeg by itself: it ends when its input closes, and the partial file left by a quit or crash is removed on the next launch.
- **Facts worth knowing:** about 13 frames a second at 1080p on the development machine. Size and frame rate come from the composition. FFmpeg is the system binary; without it the page says how to install it.
- **Not yet:** VAAPI, pausing a job, exporting several compositions in one action.

| Command                | MCP tool                | Notes                                             |
| ---------------------- | ----------------------- | ------------------------------------------------- |
| `export.enqueue`       | `export_enqueue`        | Returns `jobId`, `path`, `estimatedBytes`         |
| `export.start`         | `export_start`          | Returns at once; watch with `export_get_queue`    |
| `export.cancel`        | `export_cancel`         | Removes the partial file                          |
| `export.remove`        | `export_remove`         | Refuses a running job; a finished file stays      |
| `export.moveUp`        | `export_move_up`        | Waiting jobs only                                 |
| `export.clearFinished` | `export_clear_finished` | Files stay on disk                                |
| —                      | `export_get_queue`      | Status, progress, why one failed                  |
| —                      | `export_capabilities`   | Whether FFmpeg is here, its formats, working card |
