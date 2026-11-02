# Video Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Export tab, like Resolve's Deliver page, that turns a composition into a finished file through a queue, matching the preview exactly.

**Architecture:** A new `export` feature module owns the page, queue, commands and MCP tools. Each frame is drawn by the preview's own engine on a hidden canvas, then sent as raw pixels over a loopback HTTP route to one FFmpeg process, which also mixes the sound from the original files. Video files that preview through a 1280px proxy first get a full-size "master" copy, so the export never uses the small proxy.

**Tech Stack:** React 19, Zustand, Zod, Tauri 2, Rust (axum, tokio), system FFmpeg.

**Spec:** this document. The approved look is `.superpowers/brainstorm/215482-1793617562/content/deliver-working-v2.html`.

## Global Constraints

- FFmpeg stays an external system binary (rule 21). Nothing bundles it.
- Export renders on its own engine and never moves the user's playhead or preview.
- Size and frame rate come from the composition and can't be changed.
- A job exports a snapshot of the project taken when it was queued, so editing during an export is safe.
- Finished files appear only when complete: FFmpeg writes `<name>.partial.<ext>`, renamed on success, deleted on failure or cancel.
- Times are integer microseconds. Frame `n` is at `start + round(n * 1_000_000 / fps)`.
- Commands are non-undoable and never touch the project. Every UI action has an MCP tool.
- Tests follow CLAUDE.md rule 3: only `logic/mixdown.test.ts` qualifies, because a wrong sound mix fails silently. Everything else is checked live in the running app.

## Decisions

| Decision         | Choice                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Render path      | Preview engine frames (exact match, slower) rather than a separate FFmpeg render                                                |
| Frame transport  | Raw RGBA by HTTP POST to a loopback route with a random job token. Tauri IPC is avoided because a 1080p frame is 8 MB           |
| Sound            | One FFmpeg filter graph from the original files: delay, trim, crossfades, muted tracks left out, nested compositions included   |
| Proxied video    | Full-size H.264 master made on first export, cached with the proxies                                                            |
| Page             | New `appPages` shell point; the editor stays mounted underneath                                                                 |
| Keys on the page | Plain keys (Space, S, Delete) only work in the editor. Ctrl/Cmd shortcuts still work                                            |
| Formats          | MP4 H.264, MP4 H.265, WebM VP9, MOV ProRes, GIF, MP3. Each is greyed out with a reason when the system FFmpeg lacks its encoder |
| Graphics card    | Tries `nvenc`, `qsv`, `amf` and `videotoolbox` with a one-frame test encode, falling back to the CPU. VAAPI is left out for now |
| Colour           | Tagged BT.709, limited range, so colours don't shift in players                                                                 |
| Odd sizes        | A 4:2:0 format needs even sizes, so an odd width or height loses 1 pixel, and the UI says so                                    |
| Concurrency      | One export at a time; the rest wait                                                                                             |

## File Tree

`+` is new, `~` is changed.

```text
src/
├─ app/
│  ├─ app.keybindings.ts                 ~ plain keys only on the editor page
│  ├─ layout/LayoutHost.tsx              ~ shows the active page over the editor area
│  └─ top-bar/
│     ├─ PageTabs.tsx                    + the Edit / Export tabs
│     └─ TopBar.tsx                      ~ places PageTabs
├─ core/
│  ├─ README.md                          ~ documents pages
│  ├─ index.ts                           ~ exports appPages
│  ├─ kernel.ts                          ~ creates kernel.pages
│  ├─ kernel.types.ts                    ~ adds kernel.pages
│  └─ shell/
│     ├─ shell.pages.ts                  + per-kernel store of the active page
│     ├─ shell.points.ts                 ~ adds the appPages point
│     └─ shell.types.ts                  ~ adds AppPage
└─ modules/
   ├─ export/                            + the new feature module
   │  ├─ README.md                       + what it does, commands and tools
   │  ├─ index.ts                        + public API
   │  ├─ export.ref.ts                   + module handle
   │  ├─ export.module.ts                + wiring: store, runner, page, tools
   │  ├─ export.types.ts                 + every type of the module
   │  ├─ export.store.ts                 + queue and page-settings state
   │  ├─ export.commands.ts              + showPage, enqueue, start, cancel, remove, move, clear
   │  ├─ export.mcp.ts                   + export_* tools
   │  ├─ export.service.ts               + all Tauri calls of this module
   │  ├─ export.runner.ts                + runs one job: masters, frames, finish
   │  ├─ logic/
   │  │  ├─ presets.ts                   + kinds, quality values, per-format encoder settings
   │  │  ├─ estimate.ts                  + estimated file size and time
   │  │  ├─ timing.ts                    + frame count and frame times
   │  │  ├─ mixdown.ts                   + timeline to list of sound segments
   │  │  └─ mixdown.test.ts              + the one test
   │  └─ ui/
   │     ├─ index.ts                     + what the module contributes
   │     ├─ ExportPage.tsx               + the three-column page
   │     ├─ SaveToSection.tsx            + name and folder, at the top
   │     ├─ WhatToExportSection.tsx      + composition picker
   │     ├─ KindTiles.tsx                + Default, Small, Best, Custom
   │     ├─ QualitySlider.tsx            + smaller file to sharper picture
   │     ├─ SettingsSection.tsx          + size, rate, format, encoding, sound, graphics card
   │     ├─ RangeField.tsx               + whole timeline or only a part
   │     ├─ WhenSavingSection.tsx        + if the file exists, open the folder when finished
   │     ├─ ExportStage.tsx              + picture of the composition
   │     ├─ ExportFacts.tsx              + size, time, length, free disk
   │     ├─ ExportWarning.tsx            + the warning line
   │     ├─ QueuePanel.tsx               + queue, Export all, Clear finished
   │     ├─ QueueItem.tsx                + one job with progress and actions
   │     └─ export.form.hook.ts          + settings to estimates and warnings
   ├─ media/
   │  ├─ README.md                       ~ documents masters
   │  ├─ media.module.ts                 ~ exposes the master API
   │  ├─ media.service.ts                ~ prepareMaster, masterUrl
   │  └─ media.types.ts                  ~ the same on MediaApi
   └─ preview/
      ├─ README.md                       ~ documents offscreen rendering
      ├─ index.ts                        ~ exports the renderer types
      ├─ engine/engine.html.ts           ~ readPixels()
      ├─ preview.module.ts               ~ wires createRenderer
      ├─ preview.render.ts               + hidden renderer: frame at time to pixels
      └─ preview.types.ts                ~ FrameRenderer, readPixels on PreviewEngine

src-tauri/
├─ Cargo.toml                            ~ adds fs2 (free disk space)
├─ capabilities/default.json             ~ adds dialog:allow-ask
└─ src/
   ├─ lib.rs                             ~ registers the export module and commands
   ├─ export/                            + the native export module
   │  ├─ mod.rs                          + setup and shared state
   │  ├─ commands.rs                     + begin, finish, cancel, check, free space, unique path
   │  ├─ encoders.rs                     + which formats and graphics cards this FFmpeg has
   │  ├─ frames.rs                       + loopback route that receives frames
   │  ├─ job.rs                          + one running FFmpeg process
   │  └─ recipe.rs                       + FFmpeg arguments per format and sound graph
   └─ media/
      ├─ commands.rs                     ~ media_prepare_master
      ├─ mod.rs                          ~ registers it
      ├─ proxy.rs                        ~ the master recipe; shares find_tools and command
      ├─ registry.rs                     ~ master path and original path of an entry
      └─ server.rs                       ~ ?master=1 serves the master

CLAUDE.md                                ~ scope, rule 13, Where to look
docs/modules.md                          ~ adds export to the tier table, appPages to the points
docs/release-0.1.0.md                    ~ marks what's done and updates item 5
src/app/bootstrap.ts                     ~ lists exportModule
```

Totals: 39 new files, 30 changed files.

## Review Focus

1. **Clip whose media is missing or offline.** The job fails before any frame, naming the file. Nothing is written. Check live by moving a file.
2. **Editing or undoing during an export.** The output matches the moment it was queued, because the job holds the snapshot.
3. **Window minimized during an export.** Decoding callbacks stop on a hidden window, so the fallback timer must keep it moving, slower but correct. Check live.
4. **Disk full, or FFmpeg dies halfway.** The job says what FFmpeg said, deletes the partial file, and the next job still runs.
5. **Closing the app or cancelling during an export.** FFmpeg is killed (`kill_on_drop`), and the partial file is deleted on cancel and swept on next launch.

---

### Task 1: Pixels from the preview engine

**Files:**

- Modify: `src/modules/preview/engine/engine.html.ts`, `preview.types.ts`, `preview.module.ts`, `index.ts`, `README.md`
- Create: `src/modules/preview/preview.render.ts`

**Interfaces:**

- Produces: `PreviewApi.createRenderer(options: { compositionId, project, mediaUrl? }): FrameRenderer`
- Produces: `FrameRenderer { frameAt(time: Micros): Promise<Uint8ClampedArray>; dispose(): void }`

- [ ] **Step 1:** Add `readPixels(): Uint8ClampedArray` to `PreviewEngine`, using `getImageData` on the existing `alpha: false` context. Never set `willReadFrequently`: it draws video frames black.
- [ ] **Step 2:** Implement `createRenderer` in `preview.render.ts` on the settle loop of `preview.capture.ts`, sharing it rather than copying it. Limit 30 s per frame, a frame that never decodes is an error, and a broken font falls back as capture does.
- [ ] **Step 3:** Live check: render 30 frames of a project in the dev app and log the milliseconds per frame. If readback falls back to software or draws black on WebKitGTK, stop and report before Task 2.
- [ ] **Step 4:** `pnpm typecheck && pnpm lint`, expected to pass.
- [ ] **Step 5:** Commit.

### Task 2: Native FFmpeg job

**Files:**

- Create: `src-tauri/src/export/{mod,commands,encoders,frames,job,recipe}.rs`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `src-tauri/src/media/proxy.rs` (make `find_tools`, `command` and `Tools` `pub(crate)`)

**Interfaces:**

- Produces commands: `export_capabilities() -> { available, formats, hardware }`, `export_begin(spec) -> { jobId, frameUrl }`, `export_finish(jobId) -> path`, `export_cancel(jobId)`, `export_free_space(folder) -> bytes`, `export_unique_path(path) -> path`
- Produces route: `POST <frameUrl>` with the raw RGBA body, answering only once written to FFmpeg, so the page can't outrun the encoder.

- [ ] **Step 1:** Write `recipe.rs` with structured input, never raw FFmpeg arguments from the webview: `-f rawvideo -pix_fmt rgba -s WxH -r fps -i pipe:0`, the sound inputs and `amix` graph, the per-format encoder, BT.709 tags and `-movflags +faststart` for MP4.
- [ ] **Step 2:** Quality uses the same 10 to 100 scale for every format, mapped in `logic/presets.ts` to the `crf`, `-b:a` and `speed` values sent to Rust. GIF uses a `palettegen` / `paletteuse` graph.
- [ ] **Step 3:** Write `frames.rs`: its own loopback listener, a random token per job, the `Host` check from `media/server.rs`, and a body limit of one frame.
- [ ] **Step 4:** Write `job.rs` to hold the child with `kill_on_drop`, keep the last stderr lines, write to the partial file, and rename or delete it.
- [ ] **Step 5:** `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`, expected to pass.
- [ ] **Step 6:** Commit.

### Task 3: Masters for proxied video

**Files:**

- Modify: `src-tauri/src/media/{proxy,registry,server,commands,mod}.rs`, `src/modules/media/{media.service,media.types,media.module}.ts`, `src/modules/media/README.md`

**Interfaces:**

- Produces: `MediaApi.prepareMaster(id, onProgress): Promise<void>` and `MediaApi.masterUrl(id): string`

- [ ] **Step 1:** Add a master recipe beside the proxy recipe: original size, H.264 CRF 14, `yuv420p`, one picture stream, no timecode or data tracks (rule 21), keyframe every 15 frames so seeks stay quick. Bump `PROXY_RECIPE`.
- [ ] **Step 2:** Cache it through `cache_path(.., "master.mp4")` and share the proxy encoder semaphore. Serve it on `?master=1`. Files with no proxy return at once and use the original.
- [ ] **Step 3:** `cargo clippy --all-targets -- -D warnings && cargo test`, and `pnpm typecheck`, expected to pass.
- [ ] **Step 4:** Commit.

### Task 4: Sound mixdown

**Files:**

- Create: `src/modules/export/logic/mixdown.ts`, `mixdown.test.ts`, `src/modules/export/logic/timing.ts`

**Interfaces:**

- Produces: `mixdown(project, compositionId, range): SoundSegment[]`
- Produces: `SoundSegment { path: string; at: Micros; from: Micros; duration: Micros; fadeIn: Micros; fadeOut: Micros }`
- Produces: `frameCount(range, fps): number`, `frameTime(range, fps, n): Micros`

- [ ] **Step 1:** Write `mixdown.test.ts` with these cases: `it("places a clip at its timeline time and file offset")`, `it("leaves out muted tracks, at any depth")`, `it("offsets sound inside a placed composition by its own in-point")`, `it("gives clips under a junction an equal-power crossfade")`, `it("cuts a segment to the export range")`.
- [ ] **Step 2:** Run `pnpm vitest run src/modules/export/logic/mixdown.test.ts`, expected to fail with module not found.
- [ ] **Step 3:** Implement on audio tracks only, recursing into `compositionRef`, with overlap rules from `allowedOverlap` as `soundGains` does.
- [ ] **Step 4:** Run the same command, expected to pass.
- [ ] **Step 5:** Commit.

### Task 5: Export module, queue and agents

**Files:**

- Create: `src/modules/export/{index,export.ref,export.module,export.types,export.store,export.commands,export.mcp,export.service,export.runner}.ts`, `README.md`, `logic/presets.ts`, `logic/estimate.ts`
- Modify: `src/app/bootstrap.ts`

**Interfaces:**

- Consumes: `createRenderer`, `prepareMaster`, `masterUrl`, `mixdown`, the Task 2 commands
- Produces commands: `export.showPage`, `export.enqueue`, `export.start`, `export.cancel`, `export.remove`, `export.move`, `export.clearFinished`
- Produces tools: `export_show_page`, `export_enqueue`, `export_start`, `export_cancel`, `export_remove`, `export_move`, `export_clear_finished`, `export_get_queue`, `export_capabilities`
- Errors: `export.noFfmpeg`, `export.noComposition`, `export.missingMedia`, `export.fileExists`, `export.formatUnavailable`, `export.emptyRange`

- [ ] **Step 1:** Create the store with jobs in `waiting | preparing | rendering | finishing | done | failed | cancelled`, each with progress, message and the project snapshot.
- [ ] **Step 2:** Implement `export.enqueue` with `ifExists: "number" | "replace" | "fail"`. Validate everything before queueing. "Ask me" is UI only: the page confirms, then sends `replace`.
- [ ] **Step 3:** Implement the runner: prepare masters, begin, loop `frameAt` and POST with a check for cancel between frames, finish, then start the next job. Sound-only jobs skip the frames. Failures reach the user through `notify` and the job's message (rule 32).
- [ ] **Step 4:** Add the module to `MODULES`, tier `feature`, requires `project`, `element`, `media`, `preview`.
- [ ] **Step 5:** `pnpm typecheck && pnpm lint && pnpm test`, expected to pass.
- [ ] **Step 6:** Live check through MCP: `export_enqueue` and `export_start`, then `ffprobe` the file for size, rate, length and sound.
- [ ] **Step 7:** Commit.

### Task 6: The Export page

**Files:**

- Create: `src/core/shell/shell.pages.ts`, `src/app/top-bar/PageTabs.tsx`, every file in `src/modules/export/ui/`
- Modify: `src/core/shell/{shell.points,shell.types}.ts`, `src/core/{index,kernel,kernel.types}.ts`, `src/core/README.md`, `src/app/layout/LayoutHost.tsx`, `src/app/top-bar/TopBar.tsx`, `src/app/app.keybindings.ts`, `src-tauri/capabilities/default.json`

**Interfaces:**

- Produces: point `appPages` with `{ id, label, order?, component }`, and `kernel.pages` with `store`, `show(id)`, `activeId()`. The `editor` page is built in.

- [ ] **Step 1:** Add the point and page store, then show the page over rows 2 and 3 of the layout grid. Keep the editor mounted, and pause playback when leaving it.
- [ ] **Step 2:** Build the left column in the order approved in the mockup: Save to, What to export, Kind of export, Quality, Settings, When saving, Add to queue.
- [ ] **Step 3:** Build the stage from `preview.captureAt`, the facts and the warning line. Moving the slider updates DOM directly and estimates through `useMemo`, with no state on per-frame paths (rule 24). Picture sharpness on the stage is a hint, not the real encode.
- [ ] **Step 4:** Build the queue with per-job progress updated imperatively, Cancel, Remove, Move up, Show in folder (`revealItemInDir`) and Clear finished.
- [ ] **Step 5:** Folder default is `videoDir()/Cloudy Clip`, created on first export, chosen with the dialog plugin's `open({ directory: true })`. Remember the last folder.
- [ ] **Step 6:** When FFmpeg is missing, the page shows why and how to install it, with Add to queue disabled.
- [ ] **Step 7:** `pnpm typecheck && pnpm lint && pnpm test`, expected to pass.
- [ ] **Step 8:** Commit.

### Task 7: Live verification and docs

**Files:**

- Modify: `CLAUDE.md`, `docs/modules.md`, `docs/release-0.1.0.md`

- [ ] **Step 1:** Build one project with video, a proxied file, text, a sticker, an animated GIF, a transition and a nested composition. Export it and compare 5 frames from the output against `preview_capture_frame` at the same times.
- [ ] **Step 2:** Export one file in each of the six formats and `ffprobe` each.
- [ ] **Step 3:** Walk through all five Review Focus cases in the running app.
- [ ] **Step 4:** Check sound: a timeline with a crossfade, a muted track and silence in the middle.
- [ ] **Step 5:** Update the docs. Rule 13 gains `appPages` and the scope line drops "No export".
- [ ] **Step 6:** Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `cargo clippy --all-targets -- -D warnings` and `cargo test`, expected to pass.
- [ ] **Step 7:** Build the Linux bundles and the Windows installer. Windows stays unverified until run on a real PC, and the final report says so.
- [ ] **Step 8:** Commit.
