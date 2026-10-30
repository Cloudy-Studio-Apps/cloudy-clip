# More File Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import more video and audio formats, still images and animated images, with GIFs animating in the preview.

**Architecture:** New video and audio extensions always go through the existing proxy pipeline. `image` is a new `MediaKind`; image clips stay element kind `media` but are timeless, like text. Rust converts what the webview can't show and writes animated images as numbered PNG frames, served by id and number; the preview draws both through a new image cache, never `MediaSlotPool`.

**Tech Stack:** Tauri 2, Rust (axum, tokio), system FFmpeg, TypeScript, Zustand, Immer, Zod, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-10-30-more-file-types-design.md`

## Global Constraints

- A GIF must show animated in the preview, never as a frozen first frame. The one exception is no FFmpeg.
- All times are integer microseconds. A still lands at `5_000_000`.
- `kind_of` (Rust) and `ACCEPTED_EXTENSIONS` (TypeScript) stay matched.
- Direct stills: long side at most 3840. Converted stills: PNG, long side at most 3840. Animated frames: PNG, long side at most 1280, frame rate at most 30.
- The media server serves by id and number only. No paths from the webview.
- Where a picture sits is computed only by `clipPlacement()`. The engine paints only when every visible layer is ready.
- `PROXY_RECIPE` stays 2: the video and audio recipe doesn't change.
- Tests follow CLAUDE.md rule 3: only document integrity and native kind rules. This overrides per-step TDD elsewhere; UI, engine and pipeline work is verified live in Task 6.
- Every changed module's README is updated in the same task (rule 1). Run `pnpm typecheck && pnpm lint && pnpm test` at the end of each task, and for Rust tasks `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`.
- Work on the current branch. Commits carry no `Co-Authored-By` line.

## Review Focus

CLAUDE.md rule 3 keeps these out of the test suite, so each one is a checklist item in Task 6 instead.

- A transparent GIF over a video and across a transition: the video shows through, with no black box.
- Reopening a project with a GIF: it animates at once from the cached frames, and relinking a moved GIF keeps it animated.
- A `.png` that is really an APNG, a `.webp` that is animated, and a one-frame `.gif`: the first two animate, the last is a still.
- A failed frame extraction or a very long GIF: the clip falls back to the first frame with a message, and nothing else in the frame stalls.
- A 50-megapixel photo on the timeline: the preview stays responsive, and the same image in two clips or inside a nested composition draws in both.

---

### Task 1: More video and audio

**Files:**
- Modify: `src-tauri/src/media/registry.rs:121-127`
- Modify: `src-tauri/src/media/proxy.rs:145,161,290,526-`
- Modify: `src/modules/media/media.service.ts:47-62`
- Modify: `src/modules/media/ui/media.pick.hook.ts`
- Modify: `src/modules/media/README.md`

**Interfaces:**
- Produces: `registry::always_converted(path: &Path) -> bool`; `proxy::container_reason(path: &Path) -> Option<String>`; TS `VIDEO_EXTENSIONS`, `AUDIO_EXTENSIONS`, `ACCEPTED_EXTENSIONS: string[]` in `media.service.ts`.

- [ ] **Step 1: Write the failing Rust tests**

In `registry.rs`:

```rust
#[test]
fn new_containers_are_media_and_always_converted() {
    assert_eq!(kind_of(Path::new("/a/b.AVI")), Some(MediaKind::Video));
    assert_eq!(kind_of(Path::new("/a/b.aiff")), Some(MediaKind::Audio));
    assert!(always_converted(Path::new("/a/b.mts")));
    assert!(!always_converted(Path::new("/a/b.mp4")));
}
```

In `proxy.rs`:

```rust
#[test]
fn a_friendly_codec_in_an_avi_still_gets_a_proxy() {
    assert!(container_reason(Path::new("/a/b.avi")).unwrap().contains("AVI"));
    assert!(container_reason(Path::new("/a/b.mov")).is_none());
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd src-tauri && cargo test media::`
Expected: compile errors, `always_converted` and `container_reason` not found.

- [ ] **Step 3: Implement**

`kind_of` adds video `avi wmv asf mpg mpeg m2v vob mts m2ts ts mxf flv f4v 3gp 3g2 ogv dv` and audio `aif aiff wma ac3 eac3 dts caf amr m4b mka ape wv au`. `always_converted` is true for exactly those. `container_reason` returns `"{EXT} files are converted for editing"` with the extension uppercased.

In `ProxyJobs::start`, line 161 becomes `let Some(reason) = container_reason(&path).or_else(|| proxy_reason(&probe, kind)) else {`.

Line 145's message becomes `"FFmpeg was not found, so some formats won't play and GIFs won't move. Install FFmpeg to edit them."`. Line 290's becomes `"This file is not a readable media file"`.

In `media.service.ts`, split the list into `VIDEO_EXTENSIONS` and `AUDIO_EXTENSIONS`, with `ACCEPTED_EXTENSIONS` their concatenation. `usePickMedia` gets filters `All media`, `Video`, `Audio`.

- [ ] **Step 4: Run all checks, expecting green**

Run the Global Constraints commands. Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/media src/modules/media
git commit -m "feat(media): import more video and audio formats through proxies"
```

### Task 2: Images in the document

**Files:**
- Modify: `src/modules/project/project.types.ts:9-10`, `project.selectors.ts`, `index.ts`
- Modify: `src/modules/workspace/logic/format.ts:41`
- Modify: `src/modules/timeline/logic/trim.ts:19-21`, `timeline.split.commands.ts:78-88`, `timeline.clip.commands.ts:35,50-68,85-89`, `ui/TrackLane.tsx:69-71`
- Modify: `src/modules/composition/composition.create.commands.ts:68,72`
- Modify: `src/modules/transform/logic/layers.ts:44`
- Modify: `src/modules/inspector/ui/ClipView.tsx:21-28`
- Test: `src/modules/timeline/timeline.commands.test.ts`
- Modify: READMEs of `project`, `timeline`

**Interfaces:**
- Produces: `MediaKind = "video" | "audio" | "image"`; `followsFileTime(state: Pick<ProjectState, "media">, clip: Clip): boolean` exported from `@/modules/project`.

- [ ] **Step 1: Write the failing tests**

Add an image asset and the probe `{ status: "ready", width: 800, height: 600, duration: 5 * S }`, following how the file seeds a video.

```ts
describe("image clips", () => {
  it("lands at the file's default length, or the length asked for", async () => {
    expect(clipOf(await add({ mediaId: "photo" })).duration).toBe(5 * S);
    expect(clipOf(await add({ mediaId: "photo", duration: 9 * S, start: 20 * S })).duration).toBe(9 * S);
  });
  it("stretches past its default length and keeps sourceIn 0", async () => {
    const id = clipOf(await add({ mediaId: "photo" })).id;
    await run(trimClip, { clipId: id, edge: "end", time: 12 * S });
    expect(clip(id)).toMatchObject({ duration: 12 * S, sourceIn: 0 });
  });
  it("keeps sourceIn 0 on both halves of a split", async () => {
    const id = clipOf(await add({ mediaId: "photo" })).id;
    await run(splitAt, { time: 2 * S });
    expect(trackClips(state(), "v1").map((c) => c.sourceIn)).toEqual([0, 0]);
  });
  it("refuses an audio track and a sourceIn", async () => {
    await expectFailure(add({ mediaId: "photo", trackId: "a1" }), "timeline.kind_mismatch");
    await expectFailure(add({ mediaId: "photo", sourceIn: S }), "timeline.out_of_range");
  });
});
```

Use the file's existing helpers in place of `add`, `run`, `clip`, `clipOf`, `state` and `expectFailure` where they differ. A video trimmed with the same steps still stops at its file length, already covered by the file's tests.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm vitest run src/modules/timeline/timeline.commands.test.ts -t "image clips"`
Expected: FAIL, `"image"` isn't a `MediaKind`, or the duration is capped.

- [ ] **Step 3: Implement**

- `followsFileTime` is true for a clip with `compositionRef`, and for a clip with `mediaId` unless that asset's kind is `image`. Replaces the checks at `trim.ts:21` (`sourceless = !followsFileTime(state, clip)`), `split.commands.ts:86` (`followsFileTime(draft, left) ? left.sourceIn + offset : 0`) and `ClipView.tsx:22`. Update the comment at `split.commands.ts:78` to "Text and images have no time of their own".
- `MediaKind` comment becomes "Decided from its extension at import. Whether an image moves is read later, from the file."
- `format.ts:41`: add `"image"`. Leave the track enum at line 51 alone.
- `addClip`: an image's `kinds` is `["video"]`, without asking `mediaHasAudio`. A named track that isn't a video track fails with `timeline.kind_mismatch`, `"${media.name}" is an image; it cannot go on the audio track "${track.name}".`. `input.sourceIn > 0` fails with `timeline.out_of_range`. `duration` is `input.duration ?? total`, uncapped for images. `total` comes from `mediaDuration` unchanged, since Task 4 makes the probe report the default length. Add images to the description: "An image makes one picture clip, 5 s long unless you pass duration (an animated image: one loop), and stretches to any length."
- `TrackLane`: `const fits = !media || media.kind === "video" || media.kind === track.kind;`, with the comment updated.
- `composition.create.commands.ts`: lines 68 and 72 test `kind !== "audio"`.
- `layers.ts:44`: skip only `kind === "audio"`. `sizeOf` reads the probe's size, which Task 4 fills for images.
- `ClipView`: `kindName` shows "Image" for an image asset.

- [ ] **Step 4: Run all checks, expecting green**

Run the TS commands from Global Constraints. Expected: all pass, including the existing workspace format tests.

- [ ] **Step 5: Commit**

```bash
git add src/modules
git commit -m "feat(project): image media that stretches like text"
```

### Task 3: Native image pipeline

**Files:**
- Create: `src-tauri/src/media/image.rs`
- Modify: `src-tauri/src/media/mod.rs`, `registry.rs`, `proxy.rs`, `server.rs:54-55,76-105`
- Modify: `src/modules/media/media.types.ts:29-35`, `README.md`

**Interfaces:**
- Consumes: `registry::always_converted` from Task 1.
- Produces:
  - `MediaKind::Image`, serialized `"image"`.
  - `ProbeMeta.frames: Option<u64>`, TS `ProbeMeta.frames?: number`. Sent **only for animated images**, with `fps` and `duration` of the extracted frames. Stills send no `meta`, so `meta.frames` means animated.
  - `MediaRegistry::set_frames(&self, id: &str, dir: PathBuf)`, `frame_path_of(&self, id: &str, n: u32) -> Option<PathBuf>`.
  - Route `/media/{token}/{id}/frames/{n}` with `n: u32`, serving `{dir}/{n:05}.png`, frames numbered from 0.
  - `image.rs` holds the steps in Step 4 as one entry function called from `ProxyJobs::start`, plus `frame_rate(fps: Option<f64>) -> f64`.

- [ ] **Step 1: Write the failing Rust tests**

In `registry.rs`:

```rust
#[test]
fn images_are_media_and_frames_resolve_by_number() {
    assert_eq!(kind_of(Path::new("/a/b.GIF")), Some(MediaKind::Image));
    assert_eq!(kind_of(Path::new("/a/b.heic")), Some(MediaKind::Image));
    assert!(always_converted(Path::new("/a/b.tiff")));
    assert!(!always_converted(Path::new("/a/b.png")));
    let registry = MediaRegistry::default();
    registry.register("m", Path::new("/a/b.gif"), 1).unwrap();
    assert_eq!(registry.frame_path_of("m", 3), None);
    registry.set_frames("m", PathBuf::from("/cache/x.frames"));
    assert_eq!(registry.frame_path_of("m", 3), Some(PathBuf::from("/cache/x.frames/00003.png")));
}
```

In `image.rs`:

```rust
#[test]
fn frame_rate_is_capped_and_defaults_for_a_file_that_gives_none() {
    assert_eq!(frame_rate(Some(50.0)), 30.0);
    assert_eq!(frame_rate(Some(12.5)), 12.5);
    assert_eq!(frame_rate(None), 10.0);
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd src-tauri && cargo test media::`
Expected: compile errors.

- [ ] **Step 3: Implement the registry and server**

`kind_of` adds image `png jpg jpeg jfif webp bmp svg gif apng avif heic heif tif tiff tga dds psd exr hdr dpx jxl`. `always_converted` adds `avif heic heif tif tiff tga dds psd exr hdr dpx jxl`. `mime_of` adds `image/png`, `image/jpeg` (`jpg jpeg jfif`), `image/webp`, `image/bmp`, `image/svg+xml`, `image/gif`, `image/apng`. `Entry` gains `frames: Option<PathBuf>`, reset by `register`.

In `server.rs`, pull lines 80-96's guards into one function both handlers call, then add `handle_frame` with `UrlPath<(String, String, u32)>`. Unknown id or missing frame answers 404.

- [ ] **Step 4: Implement `image.rs`**

`proxy.rs` makes `Tools`, `ffprobe`, `command` and the cache naming `pub(super)`. `ffprobe` gains a `count_frames: bool` that adds `-count_frames`, and `Probe` gains `frames: Option<u64>` from `nb_read_frames`. `cache_path` takes `extension: &str`: `mp4`, `m4a`, `png`, or `frames` for the folder. `ProxyJobs::start` sends `MediaKind::Image` to `image.rs` after the FFmpeg check, reusing the same semaphore and `report`, with `has_audio: Some(false)`.

The steps inside, in order:

1. Probe with `count_frames: true`. `.svg` skips this and is `Skipped`: `ffprobe` misreads SVG sizes (it gave 100×100 for a 100×50 file).
2. `frames > 1`: animated. Use the folder if it exists, otherwise extract into `{hash}.partial.frames` and rename it when complete. Count the files, `set_frames`, and report `Ready` with `meta { width, height, fps, duration, frames }`, where `duration` is `frames ÷ fps` in microseconds and size is the original's, turned for rotation.
3. Otherwise, not `always_converted` and long side at most 3840: `Skipped`.
4. Otherwise convert one PNG, write to a partial name, rename, `set_proxy`, `Ready`.

Extraction flags, on top of the common `-hide_banner -nostats -loglevel error -y -i`:

```
-vf fps={frame_rate},scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease
-pix_fmt rgba -start_number 0 -f image2 {dir}/%05d.png
```

Still conversion: same scale at 3840, `-frames:v 1 -update 1 -pix_fmt rgba -f image2`. Progress during extraction uses `out_time_us` against the probed duration, as `encode` does. `frame_rate(fps: Option<f64>) -> f64` is `fps.unwrap_or(10.0).min(30.0)`.

A failed extraction or conversion reports `Error` with the message. The original stays served, so an animated file falls back to its first frame.

- [ ] **Step 5: Run all checks, expecting green**

Also run, with a real GIF in the scratchpad, the extraction flags by hand and check the frame count and that a transparent pixel stays transparent (`ffprobe -show_entries stream=pix_fmt` reports `rgba`).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/media src/modules/media
git commit -m "feat(media): convert images and extract animated frames natively"
```

### Task 4: Images in the media module

**Files:**
- Create: `src/modules/media/logic/animation.ts`
- Modify: `src/modules/media/media.probe.ts`, `media.service.ts`, `media.store.ts`, `media.module.ts`, `media.types.ts`, `media.testing.ts`, `media.element.ts`, `media.mcp.ts`, `media.commands.ts:15,78`, `ui/MediaThumb.tsx`, `ui/media.pick.hook.ts`, `README.md`

**Interfaces:**
- Consumes: `ProbeMeta.frames`, the frames route, `MediaKind` `image`.
- Produces:
  - `frameIndexAt(animation: ImageAnimation, elapsed: Micros): number` in `logic/animation.ts`: `Math.floor(microsToSeconds(elapsed) * fps) % frames`. It loops, and is why a stretched GIF keeps moving.
  - `ImageAnimation { frames: number; fps: number }`.
  - `MediaApi.animation(id: MediaId): ImageAnimation | undefined`: set only when `proxy.state === "ready"` and `proxy.meta?.frames` is above 1.
  - `MediaApi.imageFrames(id: MediaId, elapsed: Micros, ahead: Micros): string[]`: the URLs of the picture at `elapsed` followed by those up to `ahead` later, looped, without repeats. A still returns `[mediaUrl(id)]`.
  - `MediaService.frameUrl(id, index)`: `${baseUrl}/${id}/frames/${index}`, with the `file` revision query.

- [ ] **Step 1: Implement probing**

`createProbeQueue` deps gain `animation` and `frameUrl`. `probe` branches on `asset.kind === "image"` before creating a media element, into `probeImage`:

- Load `frameUrl(id, 0)` if animated, otherwise `url`, with `new Image()`, `crossOrigin = "anonymous"`, the `LOAD_TIMEOUT_MS` timeout, and `image.decode()`.
- `duration` is `meta.duration` if animated, otherwise `STILL_DURATION = 5_000_000`.
- Size is `meta` if animated, otherwise `naturalWidth/Height`. A `0` from an SVG with no size falls back to 1024×1024.
- The poster draws to a canvas `POSTER_WIDTH` wide, `toBlob("image/png")`, so transparency survives. A failed load throws "This image can't be read".

`describeMediaError` isn't involved. The existing `.catch` adds the proxy's explanation.

- [ ] **Step 2: Implement the API**

Add `frameUrl` to the service and `animation` to the state, compose `imageFrames` in `media.module.ts`, and add `imageFrames: (id: string) => [`fake://${id}`]` and `animation: () => undefined` to `createFakeMediaModule`. Each new `MediaApi` member gets TSDoc.

- [ ] **Step 3: Implement the surfaces**

- `ACCEPTED_EXTENSIONS` adds `IMAGE_EXTENSIONS`, and the picker gets an `Images` filter.
- `media.element.ts`: `display` uses lucide's `Image` icon for an image asset. Body stays `"poster"`.
- `MediaThumb`: an image never shows the PROXY badge. A still shows no duration. An animated one shows a `GIF` badge in the PROXY badge's place, whatever its format.
- `media.mcp.ts`: `describe` adds `frames: probe?.proxy?.meta?.frames`. `media_import` says "video, audio or image files", with "Images get a default length; animated images report frames". `media.import` and `media.relink` descriptions name images; `media.wrong_kind` reads "when the new file is a different kind".

- [ ] **Step 4: Run all checks, expecting green**

- [ ] **Step 5: Commit**

```bash
git add src/modules/media
git commit -m "feat(media): read images, posters and animation in the library"
```

### Task 5: Images and GIFs in the preview

**Files:**
- Create: `src/modules/preview/engine/engine.images.ts`
- Modify: `src/modules/preview/engine/engine.html.ts:51,67,107-120,153-155,323-336`, `engine.types.ts`, `src/modules/preview/preview.module.ts:36`, `README.md`

**Interfaces:**
- Consumes: `MediaApi.imageFrames` from Task 4.
- Produces: `EngineOptions.imageFrames: MediaApi["imageFrames"]`; class `ImageCache` with `constructor(onReady: () => void)`, `want(url: string, options: { raster: boolean }): void`, `ready(url: string): boolean` (true once loaded or failed, so broken media never blocks), `picture(url: string): { source: CanvasImageSource; width: number; height: number } | undefined`, `dispose(): void`.

- [ ] **Step 1: Implement `ImageCache`**

One entry per URL, with `crossOrigin = "anonymous"`. An entry counts as ready only after `await image.decode()`, so `drawImage` never decodes on the frame path, then `onReady()`. Evict oldest-used entries that aren't in this frame's wanted set once loaded pixels exceed `MAX_PIXELS = 200_000_000`. A `raster` entry (SVG) is drawn once onto a canvas with long side 2048, keeping the natural size as `width`/`height`.

- [ ] **Step 2: Wire the engine**

Add a local `const PRELOAD_FRAMES: Micros = 1_000_000;`. Whether a clip is an image is `project.media[clip.mediaId]?.kind === "image"`, and `raster` is `asset.name.toLowerCase().endsWith(".svg")`.

- `prepare`, after the `media` lookup at line 155: for an image, `urls = imageFrames(clip.mediaId, time - clip.start, PRELOAD_FRAMES)`, `want` each, and if `!track.hidden && !ready(urls[0])` set `settled = false`; `continue` before `pool.acquire`.
- The upcoming loop, after line 114: for an image, `want` the urls at `0`; `continue`.
- `drawClip`, after line 323: for an image, take `picture(imageFrames(mediaId, time - clip.start, 0)[0])`, return if undefined, then `clipPlacement(format, { width, height }, transform)` and the same four draw calls as lines 333-336. Extract those four into one private method used by both.
- `dispose` disposes the cache. `preview.module.ts:36` passes `imageFrames: media.imageFrames`.

Junctions, nesting and capture all pass through `drawClip`, so they need nothing more. Paused frames use `time`, so scrubbing a GIF moves it.

- [ ] **Step 3: Run all checks, expecting green**

- [ ] **Step 4: Commit**

```bash
git add src/modules/preview
git commit -m "feat(preview): draw images and animate GIFs"
```

### Task 6: Verify in the running app

**Files:**
- Modify: whatever the checks expose
- Modify: `CLAUDE.md` only if a rule changed

- [ ] **Step 1: Make test files in the scratchpad, using FFmpeg**

An AVI with H.264, an AIFF, a JPG, a transparent PNG, an SVG, a transparent GIF, a one-frame GIF, an APNG named `.png`, an animated WebP, and a large (8000×6000) PNG. Add a phone HEIC and a rotated TIFF if the user has them.

- [ ] **Step 2: Run `pnpm tauri dev`, and import all of them with `media_import`**

Expected: every file `ready`, `media_list` showing `frames` on the three animated ones and none on the one-frame GIF.

- [ ] **Step 3: Prove the GIF animates**

`composition_create_from_media` with the GIF, then `preview_seek` to 0, 0.1 s and 0.2 s, with `preview_capture_frame` at each. Expected: the three captures differ. Stretch the clip to three loops with `timeline_trim_clip`, seek into the third loop, and capture: expected to match the same point of the first loop. Do the same for the APNG and WebP.

- [ ] **Step 4: Run through Review Focus**

Each of its five items, with captures, plus: a transition between the GIF and a video, the project saved and reopened with no re-extraction, undo of a `media_relink`, and the canvas transform handles lining up on an image.

- [ ] **Step 5: Run all checks, expecting green**

Run the full TS and Rust commands from Global Constraints.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(media): issues found checking file types in the app"
```
