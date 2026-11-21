# Auto mask: click anything, follow it through the clip

Date: 2026-11-21. Status: design, approach chosen (a tracked matte file as a new mask kind, made in
Rust with SAM 2.1 through ONNX Runtime; Convert to path second). Prototype:
`docs/prototype/designs/auto-mask.html`.

## Intent

The owner wants rotoscoping without drawing: click a thing on one frame (a person, a car, the sky, a
cup), see its mask at once, press one button and have it followed through the whole clip. It is not
only for people: cut a person out, put text behind them, grade only the sky later. It is Resolve's
Magic Mask, After Effects' Roto Brush, CapCut's auto cutout: easy on the surface, a real mask
underneath that mixes with every other mask (mode, feather, expansion, invert).

It has to hold up to professional work, not only demos: an edge that doesn't chatter, hair that
doesn't look cut with scissors, corrections that don't cost a full re-track, and a quick way to find
the frames that went wrong.

A tracked mask can also be **converted to a path mask with keys**, to be fixed point by point like a
hand-drawn one.

There is no cloud: everything ships inside the app and runs offline. Bundle size is not a concern.

## Goals

1. **One tool for anything.** In the Mask tab, **Auto** puts the preview in picking mode. A click adds
   the thing under it (+), Alt+click takes a part away (−), a drag draws a box around it. The frame's
   mask shows in well under a second after the first click on a frame.
2. **Matte views** while picking: Overlay (tinted), Matte (black and white), Cut-out (over the
   checkerboard), Outline.
3. **Track.** Track ◀, Track ▶ or Track both follows it through the clip, as a background job with
   progress and Cancel; **results show frame by frame while it tracks**. The editor stays usable.
4. **Fix cheaply.** On a wrong frame, click again: only the stretch **from that frame out to the
   nearest other clicked frame on each side** tracks again. Frames past them keep their results.
5. **Find the problems.** Frames where the model lost the object or wasn't sure are marked on the clip,
   with "previous / next problem frame".
6. **Refine:** Consistency (steadier edge over time), Clean up (holes and specks), Edge detail (hair
   and soft edges from the picture), each previewed live, none of them re-tracking.
7. **Faster / Better** per mask: two bundled models (SAM 2.1 tiny and small); a default in Settings.
8. **A real mask.** The result is a mask in the clip's mask list (`kind: "auto"`), with mode, invert,
   opacity, feather, expansion and on/off like any other, in the preview, captures and export alike.
9. **It follows the clip**, not the timeline: moving, trimming, speed, Freeze frame and Reverse keep it
   on the thing (it is read by the clip's source time).
10. **Convert to path:** the tracked mask becomes a path mask with N points and keys, the auto mask
    replaced in one undo step.
11. **Offline, inside the app**, and **Settings**: where it runs (Auto, GPU, CPU), default quality, and
    the disk the tracked masks use, with Clear.
12. Agents can do all of it (rules 14, 18, 19); every document change is one undo step.

## Non-goals (this round, each its own feature later)

- The **mask tracker** (moving a drawn mask with an object).
- **Edge color cleanup** (decontaminate the old background's color from the edge).
- **Motion blur** on the mask.
- Auto masks in **Tint** (grading only a face). The matte is shaped so it can feed Tint's Limit later.
- **Exporting the matte** on its own (black and white, or video with alpha).
- **Full-resolution mattes** above 1920 on the long side.
- A **GPU on Linux** (to check later: ONNX Runtime's WebGPU provider over Vulkan).
- Detecting things without a click, text prompts ("the dog"), SAM 3; brush strokes as prompts.
- Auto masks on text, stickers, solids, compositions and animated images.

## Anti-goals (a failure even if it works)

- The mask slips off the thing after a trim, a move, a speed change or Reverse.
- The preview and the export cut differently.
- The app freezes while tracking, or a long track can't be cancelled.
- One click near the end of a long clip re-tracks the whole clip.
- Picking dots, tints, matte views or problem marks show up in a capture or an export.
- Anything needs the internet, or an account.
- An agent can't do what the user does, or a change that isn't one undo step.
- React state on the per-frame path (rule 24).

## Constraints from the codebase

- **License:** Cloudy Clip is AGPL-3.0-only. SAM 2.1 (code and checkpoints) is Apache 2.0 and ONNX
  Runtime is MIT: both may ship inside it, with their license texts in the bundle. SAM 3 has Meta's own
  license and is not used.
- **Track mattes don't fit:** `clip.matte` reads another track by timeline time, so a matte video on a
  track would slip off on any trim, move or speed change. The result is a mask kind read by source time.
- **Derived files already exist** (`src-tauri/src/media/derived.rs`): cached beside the proxies under a
  name that changes with every setting, served by the media server, written under a temporary name,
  attached to the registration, composable (a `Reversed` of another kind). The final matte reuses
  these. Their queue (the one encoder permit shared by proxies, masters, reversed copies and denoise)
  is **not** used for tracking, which takes minutes.
- **WebKitGTK video rules** (rules 20 to 22): the matte is a plain H.264 file with one video stream, no
  timecode or data tracks; frames are drawn only after `requestVideoFrameCallback`. WebKitGTK draws
  video into a canvas with black at about 15 and white at about 236 (`preview.levels.ts`).
- **Masks are drawn in one place** (`preview` engine, `MaskPainter`, `engine.masks.ts`), feathered on
  the GPU (`blurPasses`), with a luma-to-alpha pass already there (`lumaAlphaPass`).
- **The engine decodes through pooled `<video>` slots** (`MediaSlotPool`, `engine.slots.ts`), readiness
  per clip (`logic/readiness.ts`). There is no `FrameSource` layer yet, and this work doesn't add one.
- **`preview` and `media` are core;** they never require a feature. They may know the `auto` shape
  (declared by `project`, core) but never the `automask` module. `export` is a feature that requires
  `preview`.
- **The `mask` module owns no points today.** The Auto button and the row's actions come from the
  `automask` feature, so `mask` gains two points.
- WebGPU on WebKitGTK is not reliable, so inference runs in Rust, not in the WebView.

## Approaches considered

1. **A matte file as a mask kind (chosen).** SAM's per-frame masks are written into a grayscale video
   (a derived file), and a mask of kind `auto` draws its brightness as alpha at the clip's source time.
   Soft edges and hair survive, it mixes with the other masks for free, and the drawing path already
   has luma-to-alpha. Cost: one more video decoded per auto mask while it shows.
2. **Path keys straight away.** Every frame's outline fitted to Béziers and keyed. Editable, but hair
   and holes are lost, points jitter, and the document fills with keys. Kept as Convert to path.
3. **A track matte on a hidden track.** Slips on every trim, move, speed change and Reverse. Dropped.

Where it runs: **Rust with ONNX Runtime** (the `ort` crate) in `src-tauri/src/automask/`. The WebView
has no reliable GPU on WebKitGTK; a Python sidecar would mean shipping Python. Dropped both.

## The design

### 1. Data (owned by `project`)

A new member of `MaskShape`:

```ts
| {
    kind: "auto";
    /** Frames the user (or an agent) clicked on, at most one per frame, in source time order. */
    prompts: AutoPrompt[];
    /** The source range tracked, or null before the first Track. */
    range: { from: Micros; to: Micros } | null;
    quality: "faster" | "better";
    /** 0..100 each. Defaults: consistency 30, cleanup 20, edge 0. */
    refine: { consistency: number; cleanup: number; edge: number };
  }

interface AutoPrompt {
  /** Source time of the frame (the media file's own time, not the timeline's). */
  at: Micros;
  /** In the source picture, 0..1 from its top left, so the clip's transform never matters. */
  points: { x: number; y: number; include: boolean }[];
  box?: { x: number; y: number; width: number; height: number };
}
```

- Only a clip whose element is a media video or a still image may hold an `auto` mask
  (`automask.not_media`; animated images are refused this round). `project` validates the shape: at
  least one prompt, each with a point or a box, coordinates in 0..1, prompts sorted and on distinct
  frames, `range.from < range.to`, refine values in 0..100. The document holds no file length, so the
  commands check the range against the probe.
- **A still image** has one prompt and no range: its matte is one PNG, made from that frame's mask (with
  Clean up and Edge detail) as soon as it is clicked. Track, Consistency and problem marks are hidden.
- The mask's `x`, `y` and `rotation` stay 0 and are hidden for this kind: the matte covers the source
  picture exactly and is placed with it. `feather`, `expansion`, `opacity`, `mode`, `invert`, `on`,
  `name` and `color` work as for every mask; `feather`, `expansion` and `opacity` stay keyable. Refine
  values are not keyable.
- No file is ever in the document. Every file name is derived from document values and the recipe, so
  undo brings back earlier names whose files are still in the cache.

### 2. Tracking and the files (owned by `src-tauri/src/automask/`)

**Two models**, exported once to ONNX (image encoder, memory attention, mask decoder, memory encoder)
by a developer script (`tools/automask/sam2.export.py`, never shipped): SAM 2.1 tiny (`faster`) and
SAM 2.1 small (`better`). Stored with Git LFS under `src-tauri/resources/automask/`, bundled through
`tauri.conf.json` `bundle.resources`, with `LICENSE-SAM2` and ONNX Runtime's license next to them.
Sessions load lazily per model and stay warm. **Device:** Auto tries DirectML on Windows, else the
CPU; CPU only on Linux this round. A GPU that fails falls back to the CPU once and says so (`notify`).

**Segments.** The tracked range is cut at the clicked frames into **segments**: from `range.from` to the
first clicked frame (tracked backwards), between each two clicked frames, and from the last clicked
frame to `range.to` (tracked forwards). A segment is named by what decides it: its bounds, the prompts
on its clicked ends, the quality and `AUTOMASK_RECIPE`. A segment between two clicked frames is tracked
from both ends (both are conditioning frames in SAM's memory). So:

- a click on a new frame k splits one segment in two: only those two are tracked again;
- changing a frame's clicks re-tracks only the segments touching that frame;
- Track ◀ / ▶ add only the new outer segments;
- undo, redo and reopening find the old segments by name, already made.

**Raw results** (private to `automask`, never served): per frame, SAM's mask probability (8-bit, at
SAM's output size upscaled to at most 1024 on the long side), its **object score** and its **predicted
IoU**. Stored per segment, compressed, beside the proxies.

**Problem frames:** a frame whose object score says the object is gone is **lost**; a frame whose
predicted IoU is under `WEAK_IOU` (0.7, tuned in the spike) or whose mask area changes by more than
`AREA_JUMP` (35%) from the frame before is **unsure**. Read from the raw results, returned with the
status.

**The matte** (a `DerivedKind`, `automask/matte.rs`), named by the segment names and the refine
values: the raw frames of the range, refined, upscaled to the source size capped at 1920 on the long
side, written as gray (`yuv420p`, luma = alpha, high quality) under the proxy rules
(`-dn -write_tmcd 0 -map_metadata -1`), starting at `range.from`. Refine, in order:

- **Consistency** (temporal): each pixel's probability averaged with the frames around it, up to ±3
  frames at 100, weighted down where the probability changes fast, so still edges steady and moving
  ones don't smear;
- **Clean up**: specks and holes smaller than up to 0.5% of the picture's area (at 100) are removed or
  filled;
- **Edge detail**: a guided filter with the source frame as the guide over the edge band, its radius
  and strength growing with the value, so hair and soft edges follow the picture;
- then the probability to alpha with a soft threshold.

Making the matte from raw results takes seconds, not minutes, so moving a refine value never re-tracks.
A reversed copy for reversed clips comes from the existing `Reversed { of: Some(name) }`.

**Live while tracking:** each tracked frame sends an event (frame time, a small 8-bit mask, the
scores). **Picking a frame** (`automask_frame`): the frame's embedding is computed once and kept (a
small LRU per model), so later clicks on the same frame only run the decoder; it returns that frame's
mask, with the current refine values (Consistency off: one frame), as a small image. The same command
serves a frame already tracked (from the raw results) for the overlay.

**The queue:** `automask` keeps its own (one segment at a time, never the shared encoder permit), with
a cancel per job. **Wanted names**, as denoise does (`wantDenoised`): the module watches the document
and wants, for every `auto` mask with a range, its segments and its matte. A missing one is queued; a
running one no longer wanted (an undo, a new click, a deleted mask) is cancelled. While picking, nothing
new is wanted for the mask being picked: tracking waits for Track or Done. Missing files (another
computer, Clear) are made again in the background when the project opens, one at a time, cancellable
from the mask row.

### 3. Drawing (owned by `preview`'s engine)

- **How `preview` finds a matte without knowing `automask`:** a new point owned by `preview`,
  `maskSources` (keyed by shape kind), filled by `automask`: `url(clip, mask, { reversed })` gives the
  matte to draw now (or null), and `prepare(clip, mask, { reversed })` resolves once the wanted matte
  exists, making it if needed. The engine draws with `url`; export calls `prepare` before it renders,
  as it prepares masters and reversed copies. Rule 13 gains "the preview reads … `maskSources`".
  `MediaApi` exports the derived-file URL (`MediaService.derivedFileUrl`).
- **Decoding:** a matte is a second slot in `MediaSlotPool` for its clip, keyed by the clip's path plus
  the mask id, seeked to the clip's source time minus `range.from`; readiness waits for the clip and its
  mattes, and the engine paints only when it has every frame (rule 22). A still's PNG matte goes
  through `engine.images.ts`.
- `MaskPainter` draws it into the clip's alpha canvas like the other kinds: luma to alpha **with a fixed
  remap of 16..235 to 0..1, clamped** (without it about 6% of what was cut stays visible), the same pass
  in the preview and in export; placed with the clip's picture mapping (`maskPlacement`, rule 23); then
  expansion (blur and level on the GPU), feather (`blurPasses`), invert, opacity, combined by mode.
- **Out of date** (clicks, quality or refine changed, or tracking again): the preview keeps drawing the
  **last matte made for that mask** (its name kept per mask in the module's ephemeral store), tagged
  "Changed" or "Tracking 42%". **Never made** (no range, or nothing made yet): the mask counts as off.
  Outside the tracked range it is off.
- **Captures never wait for tracking:** a capture draws what the preview would, so
  `preview_capture_frame` stays quick. **Export waits** for the wanted matte (`prepare`).

### 4. The `automask` feature module (`src/modules/automask/`)

- **Tier:** feature. **Requires:** `project`, `mask` (its points, `ui`, the mask list), `media`
  (`derivedFileUrl`, the registration, the probe), `preview` (the playhead, `previewOverlays`,
  `maskSources`), `inspector`, `timeline` (the selection, `timelineOverlays` for the marks),
  `transform` (`useVisibleLayers`, the canvas mapping), `settings` (`settingsSections`), `keyframe`
  (the path's keys on convert).
- **New points in `mask`:** `maskTools` (buttons beside Pen and Freehand; `automask` adds **Auto**) and
  `maskRowActions` (items in a mask row's menu; `automask` adds **Edit clicks**, **Track again** and
  **Convert to path** for `auto` masks).
- **The picking bar** (`ui/AutoPicking.tsx`, a `previewOverlays` contribution, mounted only while
  picking): **Add (+)**, **Remove (−)**, **Box**, **Clear frame**; **View** (Overlay, Matte, Cut-out,
  Outline; keys 1 to 4); **◀ problem / problem ▶** (`[` and `]`); **Track ◀**, **Track both**,
  **Track ▶**; **Done**. A click sends one `automask.setPrompt` for the frame under the playhead (the
  first click on a clip creates the mask: `automask.add`). The frame's mask comes from
  `automask_frame` and is drawn in the chosen view, DOM only: Overlay tints it in the mask's color at
  45% with the dots green (+) and red (−); Matte shows white on black; Cut-out shows the picture over
  the checkerboard; Outline draws the edge. Escape or Done leaves picking. The view is ephemeral and
  stays chosen for the session.
- **While tracking:** the mask row shows a `ProgressBar` and Cancel; on the timeline clip a stripe grows
  out from the clicked frames as segments finish. **Follow** (on by default, off once the user moves the
  playhead) moves the playhead with the tracking front, and the overlay shows each frame as it comes in
  the chosen view, so a wrong turn can be cancelled at once. Done is a toast ("Mask tracked: 12 s in
  1 min 40 s"); a failure is a toast with why.
- **Marks on the clip** (`timelineOverlays`, while the clip's auto mask is selected or picking): a
  diamond per clicked frame, and red ticks for **lost** and amber for **unsure** frames, merged into
  spans when they touch. The Mask tab says "3 problem spans" with ◀ / ▶.
- **The mask's section** (an `inspectorSections` contribution for `auto` masks): status line; the
  clicked frames (time, +n, −n, box; a click goes there); **Quality** (`SegmentedControl` Faster /
  Better; changing it re-tracks, said in its tip); **Refine**: Consistency, Clean up, Edge detail
  (`SliderField`s: a drag previews the frame under the playhead through `automask_frame`, release
  sends one `automask.setOptions`); Edit clicks, Track, Convert to path.
- **Convert to path** (`ui/ConvertDialog.tsx`): Points (8 to 64, default 24), Smoothness (keeps a key
  only where the shape moved more than 0.5 to 4 output px, default 1.5), a preview of the outline at
  the playhead, Convert. Built from the final matte (after refine). Only the largest piece is kept;
  holes and other pieces are dropped, said in the dialog when the matte has them.
- **Logic** (`logic/`): `segments.ts` (the range cut at clicked frames, each segment's name, what a
  change makes wanted), `problems.ts` (spans from per-frame scores), `outline.ts`, `resample.ts` (N
  points by arc length, start and direction lined up with the previous frame), `fit.ts` (handles from
  Catmull-Rom), `thin.ts` (keys dropped where interpolation stays within the smoothness).
- **Settings section** `automask.settings` ("Auto mask", `settingsSections`): **Run on** (Auto, GPU,
  CPU; GPU disabled with why on Linux and when none is found), **Default quality** (Faster, Better: what
  a new auto mask gets), **Tracked masks on disk** (the size, and Clear: deletes every automask file;
  masks are made again in the background and say so), and the models with their licenses. A saved
  store (`createSavedStore`), the user's, never the project's.

| Command               | MCP tool               | Undo | Notes |
| --------------------- | ---------------------- | ---- | ----- |
| `automask.add`        | `automask_add`         | yes  | `clipId`, `at` (composition time), `points` (`{ x, y, include }` in output px), `box?` (output px), `name?`, `quality?` (default from Settings). Mapped through the clip's placement into the source picture. `clip_not_found`, `not_media`, `off_picture`. Returns `maskId` |
| `automask.setPrompt`  | `automask_set_prompt`  | yes  | `clipId`, `maskId`, `at`, `points`, `box?`: replaces that frame's clicks; empty removes the frame (the last one can't go: `automask.last_prompt`). `off_picture` |
| `automask.setOptions` | `automask_set_options` | yes  | `clipId`, `maskId`, `quality?`, `refine?` (any of the three). Quality re-tracks; refine only remakes the matte |
| `automask.track`      | `automask_track`       | yes  | `clipId`, `maskId`, `from?`, `to?` (source time): writes `range`, which makes its segments wanted; returns at once. The buttons **widen** the range, never shrink it: Track ◀ sets `from` to the clip's start, Track ▶ sets `to` to its end, Track both does both; the side not named keeps the earlier range, or the clicked frames' span on a first track. `not_still` for a still image |
| `automask.cancel`     | `automask_cancel`      | no   | `clipId`, `maskId`: stops its jobs (the range stays; what finished is kept) |
| `automask.toPath`     | `automask_to_path`     | yes  | `clipId`, `maskId`, `points?`, `smoothness?`: replaces the auto mask with a path mask with keys, same name, mode, invert, opacity, feather and expansion. `not_tracked` before its matte exists |
| (read)                | `automask_status`      | –    | Every auto mask: `untracked`, `tracking` (progress), `changed` (drawing the last matte), `ready`, `failed` (why); its problem spans (`lost`, `unsure`, source and composition times) |
| (read)                | `automask_look`        | –    | `clipId`, `maskId`, `at?` (default your playhead), `view?` (`overlay` default, `matte`, `cutout`, `outline`): an image of that frame as the picking view shows it, plus coverage (0..1) and bounding box in output px. Works before any tracking. A capture never shows it |

Settings, picking mode, the view and Follow have no MCP tools: they are the user's screen and machine.

### 5. Agents

An agent looks with `preview_capture_frame`, calls `automask_add` with output px at a time, checks the
result with `automask_look` (the picking view the user gets), corrects with `automask_set_prompt`,
tracks with `automask_track`, polls `automask_status`, looks at each problem span with `automask_look`
and fixes it with `automask_set_prompt` (only that stretch re-tracks). `mask_list` shows `auto` masks
with their prompts, range, quality and refine.

## Calls made (check these)

- `preview` owns a new point, `maskSources`, so neither `preview` nor `export` knows `automask`.
- No `FrameSource` layer: a matte is a second slot in the existing pool.
- Tracking has its own queue and never holds the shared encoder permit.
- "Wanted names", as denoise does: undoing stops the jobs nothing wants; missing files are made again
  in the background when the project opens.
- While out of date, the preview keeps drawing the last matte; captures never wait; export does.
- Still images get a one-frame PNG matte with no Track; animated images are refused this round.
- The matte's luma is remapped 16..235 to 0..1 and clamped, in the preview and in export alike.
- Track ◀ / ▶ widen the range, never shrink it.
- Segments between clicked frames, tracked from both ends: a correction re-tracks only the segments
  touching its frame.
- Raw results kept apart from the matte, so refine never re-tracks.
- Quality and refine live on the mask (in the document); Settings holds only the default quality.
- Consistency 30, Clean up 20, Edge detail 0 by default (Edge detail costs the most).
- Follow during tracking is on until the user moves the playhead.

## Shortcuts (known limits)

- One matte resolution (source, capped at 1920) for preview and export. Upgrade: a full-size export
  matte, when 4K exports show soft edges.
- CPU only on Linux. Upgrade: ONNX Runtime's WebGPU provider (Vulkan), once it's proven.
- Problem thresholds (`WEAK_IOU`, `AREA_JUMP`) are fixed numbers. Upgrade: a sensitivity setting, if
  users find too many or too few.

## Stage 0: the spike (before any plan task)

Throwaway, to prove the risky part: export SAM 2.1 tiny and small to ONNX, run the video loop from Rust
with `ort` on the prototype footage and on a 1080p clip of a person walking. Check:

- the masks follow a person and an object;
- a segment tracked from both of its clicked ends works with two conditioning frames;
- the object score and predicted IoU flag frames where the object is lost or the mask is wrong;
- a click's mask comes back in under 1 s on the CPU (tiny);
- tracking runs at 2 frames a second or more on the CPU at 1080p (tiny), and the small model's speed is
  measured.

Then tune `WEAK_IOU` and `AREA_JUMP`. If it fails, come back to the owner before planning (a smaller
input, tracking every other frame, or a different model).

## Left to the builder

- The exact ONNX split and how SAM's memory bank is kept between frames and segments.
- The raw results' storage format.
- How expansion is done on the matte (blur and level, or a min/max pass).
- The encoder settings of the matte file, within the proxy rules.
- The size of the embedding cache.

## Tests (rule 3 only)

- `automask.add`, `automask.setPrompt`, `automask.setOptions` and `automask.toPath`: validation and
  one undo step each (the document's integrity).
- `logic/segments.ts`: which segments a change makes wanted and that their names change exactly when
  their inputs do. A wrong name silently reuses a stale result, and nothing else would catch it.
- No tests for the UI, the outline logic or the Rust side; the spike and the live check cover them.

## Done means

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `cargo clippy --all-targets -- -D warnings` and
  `cargo test` pass.
- In the running app, through MCP and by hand: a person and an object masked and tracked on real
  footage; a correction near the end re-tracks only its stretch; problem marks lead to real problems;
  refine changes the edge without re-tracking; Faster and Better both work; inverted with text behind
  the person; trimmed, sped up and reversed with the mask still on them; exported; converted to a path.
- The READMEs of `project`, `mask`, `preview`, `media` and the new `automask` say what changed, and
  CLAUDE.md's rule 13 lists `maskTools`, `maskRowActions` and `maskSources`.
