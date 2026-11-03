# media

Importing files, reading their metadata, editing proxies, and the Media panel (a tab of the
rail), from which compositions and files are dragged onto the timeline.

- **Tier:** core
- **Requires:** `project`, `element`
- **Contributes:** panel `media.library` (side, icon `SquarePlay`); element `media`
  (`media.element.ts`: no own properties, supports `transform`, `picture: { fit: "contain",
source: "media" }`, labelled with the file name, a filmstrip on video tracks and a waveform on audio; image clips are the same element, drawn by the preview's image cache); page `media.page` (`appPages`, icon `Images`), empty for now
- **Points it owns:** `librarySections` (`media.points.ts`): sections above the files (`composition` contributes its own).
- **API** (`useModule(mediaRef)` / `ctx.require(mediaRef)`): `probes`, `fileDrop`, `getProbe`,
  `waitForProbe`, `pictureMeta(id)` (size, frame rate, length as soon as ffprobe has read them, rotation included), `mediaUrl`, `animation(id)` (frames and rate of an animated image), `imageFrames(id, elapsed, ahead)` (the URLs of an image's picture at a moment and those after it, looped), `restore(assets)` (registers a saved project's files, marks those not found `missing`, returns them), and the derived files below. `useLocateMedia()` asks where a missing file went and looks for the others in that folder. `mediaHasAudio(probe)` (exported helper) says whether a file has
  sound (true unless ffprobe found none). `createFakeMediaModule(probes)` (`media.testing.ts`) stands in for it
  in tests.
- **Exports:** `MEDIA_PAGE`, the id of the Media page, for `showPage`.
- **Derived files** (`media.derived.ts`, `src-tauri/src/media/derived.rs`): copies FFmpeg makes from a file once, which the media server then streams. `derived.rs` does what every kind shares: the cache beside the proxies (named by the source file's version and the kind's `name()`, which changes with each setting and recipe that changes the file), one encode at a time, progress as 0..1, and attaching the file to the registration it was made for (`set_derived`, `derived_path_of`). A kind (`DerivedKind`) says only what it's made from, its name and how FFmpeg makes it. `media.derived.ts` keeps the jobs per kernel, by key (the file's revision included, so a relinked file gets its own): asking again joins a running job, and a finished or failed one isn't started again.
  - **Reversed copies** (`src-tauri/src/media/reversed.rs`): `prepareReversed(id, full, onProgress?)` makes a copy of a file that runs backwards, `full` for export. `reversedUrl(id, full)` gives its URL (`?reversed=1`, with `&master=1` for `full`), or null while it's being made, starting it if needed. FFmpeg's `reverse` holds what it reverses in memory, so a file is reversed in 10-second pieces and joined last to first. Sound stays plain samples until the join and is encoded once, since encoded pieces each add a gap that drifts over minutes. They follow the proxy rules.
  - **Denoised files** (`src-tauri/src/sound/denoise.rs`, `sound_denoise`): `denoised(id, settings)` is a file's sound with its noise taken away (`afftdn=nr=<amountDb>:nf=<floorDb>`, the original's first sound stream to a 16-bit WAV, named by `DENOISE_RECIPE` and the settings): its path once made, otherwise a promise of it, starting it. `denoisedUrl(id, settings)` streams it (`?derived=<name>`), or is null while it renders, starting it. `denoising` (a store) lists the files rendering, with their progress; a failure is told once and the original keeps playing. `measureFloor(id, from, to)` (`sound_measure_floor`) is the overall noise floor `astats` reads over a stretch of the original, rounded, within -80 to -20 dBFS.
- **Media page** (`ui/MediaPage.tsx`): Disks, Bins and Smart bins on the left, the files in the middle, the viewer and file info on the right. Bins, solids and metadata are document state; what's open (`LibraryView`: place, search, layout, selection) is the per-kernel `view` store, shared with Edit's Media tab. `logic/library.ts` (`libraryRows`) decides what a place lists. A bin lists its sub-bins first, as folders: a double click opens one, and files can be dropped on it. A right click on the middle column offers New bin and Import media. Modules add kinds of item with the `libraryKinds` point. `FileFactsSection` and `MetadataSection` are exported for the inspector's File tab.
- **Files:**
  - Native side (`src-tauri/src/media`): `media_register` validates paths into an id → path
    allowlist, under ids TypeScript made, so a saved project keeps them (registering an id again
    replaces it); `media_stat` says what a file is without registering it; a loopback HTTP server streams them with Range support (`media_server_url`).
  - Proxies: pro/camera formats (ProRes, APV, 10-bit HEVC, high bitrates, 24-bit PCM, …) and containers
    a media element can't open (`always_converted`: AVI, MPG, MTS, MXF, AIFF, WMA, …) get a light
    H.264 copy made with the system FFmpeg. Progress arrives as `media://proxy` events and is stored
    in `probe.proxy`, with `hasAudio` once ffprobe has read the streams. Without FFmpeg, files are
    played directly.
  - Masters: a proxy is capped at 1280, too small to export from, so `prepareMaster(id, onProgress)` makes a full-size H.264 copy of
    a file that has one (`media_prepare_master`, cached with the proxies, one encode at a time), streamed by `masterUrl(id)`
    (`?master=1`), which serves the original for a file with no proxy. Only export uses it; it has no sound, which export mixes from the originals.
  - `media.service.ts`: the native calls and the proxy listener.
  - Images (`src-tauri/src/media/image.rs`): in the proxy pipeline, under its encoder and cache. PNG, JPG, WebP, BMP, SVG and GIF
    are served as they are up to 3840 on the long side; the rest (HEIC, TIFF, PSD, AVIF, …) and larger ones become one PNG. A file
    with several frames is animated whatever its extension says, and ffprobe has to count them: animated WebP and APNG report no
    length. Its frames go into a cache folder as PNGs at a steady rate (at most 30 fps, 1280 on the long side), which keeps
    transparency everywhere, and are served by number at `<url>/<id>/frames/<n>`. Only animated images send `meta`, with `frames`. At most 900 frames are kept, and the file's message says so. A file whose frames are in the cache isn't decoded again to count them. A job on a file that has since been replaced (relink, undo) changes nothing: `is_current` compares the registration it started from. Without FFmpeg, a GIF shows its first frame.
  - `media.files.ts`: keeps the registry and probes in step with the document: probes what comes in, and when an item's path changes (relink, undo, redo) registers the new file and reads it again. `MediaProbe.revision` is in its URL, so media elements reload.
  - `media.probe.ts`: once the proxy state settles, a bounded queue reads each file. Images load in a plain `Image` (size, a PNG poster that keeps transparency, and the length they land at: 5 s for a still, one loop when animated). Others load in a hidden
    media element to read duration, size and a poster (the element is silenced with `volume = 0`,
    not `muted`: WebKitGTK draws a muted video's frames to a canvas as black). Results live in `probes` (per kernel, not
    undoable). A file that can't be decoded gets `status: "error"` with a reason; it never throws.
  - `media.drag.ts`: pointer-based drag of a `LibraryItem` to the timeline; drop targets listen for `MEDIA_DROP`.
  - OS file drop is handled in `setup` (Tauri's drag-drop event drives `fileDrop` and the overlay).
  - `ui/`: `MediaLibrary` (header, bin picker, rows, empty state, drop hint/overlay), `MediaPage`, `MediaTile`,
    `MediaThumb`, `media.pick.hook.ts` (the file picker).
- **Not yet:** search, filters, folders, list view.

Native side: `src-tauri/src/media/facts.rs` (`media_file_facts`: ffprobe on the original; without ffprobe every field is missing) and `disks.rs` (`media_list_disks`: mounted disks, no pseudo filesystems).

| Command           | MCP tool            | Notes                                                                                     |
| ----------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `media.import`    | `media_import`      | Tool waits until metadata is read                                                         |
| `media.remove`    | `media_remove`      | Refuses while clips use the media                                                         |
| `media.relink`    | `media_relink`      | Keeps its clips. `media.wrong_kind`                                                       |
| `media.setInfo`   | `media_set_info`    | Metadata of the file; `null` clears a field                                               |
| `media.rename`    | `media_rename`      | The name in the library, not on disk                                                      |
| `media.createBin` | `media_create_bin`  | In Master or inside `parentId`. `media.no_bin`                                            |
| `media.renameBin` | `media_rename_bin`  | `media.no_bin`                                                                            |
| `media.deleteBin` | `media_delete_bin`  | What it holds moves to its parent; nothing is lost                                        |
| `media.moveToBin` | `media_move_to_bin` | Files and bins, into a bin or to Master (`null`). `media.bin_cycle`                       |
| `media.reveal`    | none                | Opens the Media page on the file. It moves the user's view, so no tool. `media.not_found` |
| —                 | `media_list`        | Media with metadata and status                                                            |
