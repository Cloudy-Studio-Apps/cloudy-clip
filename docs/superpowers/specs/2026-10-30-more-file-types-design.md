# More file types

## Why

Cloudy Clip imports 5 video and 8 audio extensions and no images. An editor has to take what people
actually drop on it: phone and camera files, old formats, logos, photos, GIFs. A file refused at the
door ends the session before editing starts, and agents hit the same wall through `media_import`.

## Goals

- Import more video and audio formats, which play through the existing proxy pipeline.
- Import still images as a new media kind: placed, transformed, cut and given transitions like any
  picture.
- Import animated images (GIF, animated WebP, APNG) and keep their transparency. **A GIF must show
  animated in the preview, never as a frozen first frame** (the one exception is having no FFmpeg).
- Everything works the same for agents: `media_import`, `media_list`, `timeline_add_clip`.
- Saved projects keep these files; relinking a moved image works like a moved video.

## Non-goals

- Subtitle files and Lottie: agreed for later.
- Image sequences (a folder of numbered frames).
- Camera RAW (CR2, NEF, ARW) and R3D/BRAW: FFmpeg can't decode them properly, and R3D/BRAW need
  vendor SDKs. They stay refused with the usual "Unsupported file type".
- HDR tone mapping: EXR and HDR files are converted plainly and may look flat. PSD shows the flattened
  picture, not layers.

## Anti-goals

- A still that can't be stretched, or that stops at an invented length.
- Pictures that lose transparency, or a black poster for a transparent file.
- Depending on one platform's decoder for alpha. VP9 alpha is out: macOS WebKit doesn't have it, and
  macOS is the next target.
- Any new way for the webview to reach files by path. The media server stays an allowlist by id.

## Formats

| Group | Added                                                               | How it plays                                 |
| ----- | ------------------------------------------------------------------- | -------------------------------------------- |
| Video | avi wmv asf mpg mpeg m2v vob mts m2ts ts mxf flv f4v 3gp 3g2 ogv dv | Always a proxy, whatever the codec           |
| Audio | aif aiff wma ac3 eac3 dts caf amr m4b mka ape wv au                 | Always a proxy                               |
| Image | png jpg jpeg jfif webp bmp svg gif apng                             | Shown directly, unless too large or animated |
| Image | avif heic heif tif tiff tga dds psd exr hdr dpx jxl                 | Always converted to a PNG with FFmpeg        |

The existing lists keep their behaviour. `kind_of` in Rust and `ACCEPTED_EXTENSIONS` in TypeScript
stay matched.

Without FFmpeg: direct images still work (a GIF shows its first frame, and its proxy message says
animation needs FFmpeg). Everything that needs conversion ends in `status: "error"`, and the message
says to install FFmpeg. Formats a given FFmpeg build lacks (HEIC, JXL) fail the same way, per file.

## How it works

### Video and audio

`proxy_reason` gains one rule: an extension outside today's list always gets a proxy, even with a
friendly codec, because an AVI holding H.264 still won't load in a media element. The reason says so
in plain words ("AVI files are converted for editing"). The recipe is unchanged, so `PROXY_RECIPE`
isn't bumped. `mime_of` needs no new video or audio entries, since these are never served directly.

### A new media kind

`MediaKind` becomes `"video" | "audio" | "image"`, in TypeScript, Rust and the media `kind` enum of
`workspace/logic/format.ts`. The project format version doesn't change: old files are still valid.

Clips stay element kind `media`, with a `mediaId`, so `isMediaInUse`, relink and the Library drag all
work as they do. An image has no time of its own, so **clips of images are treated as timeless**:

- `project` gets one selector saying whether a clip follows its file's time (true for video and audio
  clips, false for image clips and sourceless ones). `trimLimits`, split, and the inspector's
  "Source in" row use it instead of `clip.mediaId === undefined`. `sourceIn` stays 0, and both edges
  stretch freely, exactly like text.
- `timeline.addClip`: a still lands at 5 s, an animated image at one full loop. Passing `duration`
  sets any length. A `sourceIn` above 0 fails with `timeline.out_of_range`. Images only go on video
  tracks; naming an audio track fails with `timeline.kind_mismatch`, and a drop on an audio lane lands on a
  video track, as an audio file dropped on a video lane does the reverse.
- `pictureMeta` works for images: duration is the same default length, fps is 30 for a still, so
  `composition.createFromMedia` makes a composition the size of the picture.
- `transform/logic/layers.ts` accepts `image` where it accepts `video`, with the size from
  `pictureMeta`.

### Native side

A new file, `src-tauri/src/media/image.rs`, holds the image half of the pipeline. `ProxyJobs::start`
sends `MediaKind::Image` there, and it shares the one-encode-at-a-time semaphore and the cache key.

1. `ffprobe` with `-count_frames`, for images only, because that decodes the whole file. Animated
   WebP and APNG report no duration, so the length is frames ÷ frame rate. More than one frame means
   animated; `.png`, `.webp` and `.gif` can each be either, so the extension can't decide.
2. Still, direct format, long side up to 3840: `Skipped`, the original is served.
3. Still, otherwise: FFmpeg writes one PNG, long side at most 3840, as the entry's proxy.
4. Animated: FFmpeg writes one PNG per frame into a cache folder, at constant frame rate (the file's
   average, at most 30) and long side at most 1280. PNG because every FFmpeg build has it and it keeps
   alpha. The folder is written under a partial name and renamed when complete, like proxies are.

`ProbeMeta` gains `frames: Option<u32>`, and for an animated image it carries size, fps and duration.
`Entry` gains `frames: Option<PathBuf>`. The server gains one route,
`/media/<token>/<id>/frames/<n>`, which takes a number, not a path, under the same token and loopback
guards. `mime_of` gains the image types it serves directly. Rust's `Probe::meta()` no longer requires
`format.duration` for images.

### Frontend

`media.probe.ts` reads an image with `new Image()` (`crossOrigin = "anonymous"`), not a media element.
That gives the shown size (with EXIF orientation applied) and a poster. Image posters are PNG, not
JPEG, so transparency survives. For an animated image, the poster is frame 1 and its size comes from
`meta`. A file that won't load gets `status: "error"`, as a video does.

`MediaApi` gains `frameUrl(id, index)`.

**Preview.** Images never enter `MediaSlotPool`. A new `preview/engine/engine.images.ts` is a small
per-engine cache of decoded images keyed by URL, dropping the oldest past a limit, following
`sticker.art.ts`. `prepare` asks it for the clip's picture (for animated clips, the current frame and
about a second ahead) and sets `settled = false` until it has it, so rule 22 still holds: the engine
paints only when every visible layer is ready. A failed image never blocks the other layers.
`drawClip` draws it through `clipPlacement()`, so canvas tools agree and junctions, nesting and
capture need nothing new.

An animated clip picks its frame from time since the clip started, modulo its length, so stretching
loops it. An SVG is rasterized once, long side 2048, because `sticker.art.ts` found that drawing a
large SVG every frame is too slow.

**Library and timeline.** `usePickMedia` gets filters for All media, Video, Audio and Images.
`media.element.ts` shows an image icon for image clips. `MediaThumb` shows no duration on a still, a
GIF badge on an animated image, and no PROXY badge on either. The timeline's `poster` body already
works from `posterUrl`.

**Agents.** `media_list` reports `kind` and `frames`. The descriptions of `media.import`,
`media.relink` and `timeline.addClip` mention images, the 5 s default and looping.

## Tests

Only what rule 3 allows: in the timeline tests, an image clip is placed at the default length, stretches
past it, keeps `sourceIn` 0 through a split, and is refused on an audio track. Rust: extend the
`kind_of` test to the new groups, and test that a friendly codec in an AVI gets a proxy.

## Verification in the running app

Import through MCP, place, capture a frame, reopen the project, for: an AVI with H.264, an AIFF, a
JPG, a transparent PNG over a video, an SVG, a HEIC from a phone, a transparent GIF across a
transition, and a stretched GIF to see it loop. Check that phone HEIC and TIFF land upright, because
FFmpeg's handling of EXIF rotation for those needs confirming.

## Docs

Update `src/modules/media/README.md`, `src/modules/preview/README.md`, the timeline README, and the
`MediaKind` comment in `project.types.ts`.

## My calls, for you to check

- **Animated images loop and stretch freely** instead of stopping at file length like a video. Same
  rule as stills, which is simpler to use, and most GIFs are loops.
- **Frames on disk for animation**, not a video proxy: it's the one way to keep transparency on every
  platform. It costs cache space, roughly 100 MB for a 1,000-frame GIF, with no cleanup yet (proxies
  have none either).
- **Stills default to 5 s.**
- **Very large stills get a 3840 copy** for the preview. The original is kept for export.
- **Duration badge hidden on stills**, since their length means nothing.
