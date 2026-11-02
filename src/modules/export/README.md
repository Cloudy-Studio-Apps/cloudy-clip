# export

Turns a composition into a file. The Export page, next to Edit in the top bar, sets what to make; exports wait in a queue and run one at a time while you keep editing.

- **Tier:** feature
- **Requires:** `project`, `media`, `preview`
- **Contributes:** page `export.page` (`appPages`)
- **API** (`useModule(exportRef)` / `ctx.require(exportRef)`): `queue`, `form`, `capabilities`, `runner`
- **Files:**
  - `export.commands.ts`: `enqueue` checks everything and keeps the document as it is, so later edits don't reach a queued export.
  - `export.runner.ts`: one job at a time, outside the bus. A file with a proxy gets its master first (`media.prepareMaster`), the webview's video levels are measured once (`preview.measureVideoLevels`), then each frame is drawn by `preview.createRenderer` and posted to FFmpeg, which sets the pace.
  - `logic/mixdown.ts`: what sounds in a stretch of a composition, at any depth, as stretches of the original files. Muted tracks are left out; clips under a junction get equal-power fades.
  - `logic/timing.ts`: a frame is drawn 1 ms into its time. A time rounded to microseconds can fall just before its frame, and a seek there lands on the previous one.
  - `logic/presets.ts`: kinds, formats and the 10–100 quality scale as encoder numbers. `logic/estimate.ts`: rough size and time.
  - `export.service.ts`: the native calls. `ui/`: the page.
  - Native (`src-tauri/src/export`): `recipe.rs` turns a structured spec into FFmpeg arguments, `job.rs` runs one FFmpeg on `<name>.partial.<ext>` and renames it when complete, `frames.rs` takes frames as raw RGBA over loopback HTTP (a frame is too big for the JSON path IPC takes on Linux), `encoders.rs` says what this FFmpeg can write and which graphics card encoder really works. A partial file left by a crash or quit is removed on the next launch.
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
