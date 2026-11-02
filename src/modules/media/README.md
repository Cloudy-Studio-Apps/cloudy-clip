# media

Importing files, reading their metadata, editing proxies, and the Library panel (a tab of the
rail), from which compositions and files are dragged onto the timeline.

- **Tier:** core
- **Requires:** `project`, `element`
- **Contributes:** panel `media.library` (side, icon `SquarePlay`); element `media`
  (`media.element.ts`: no own properties, supports `transform`, `picture: { fit: "contain",
source: "media" }`, labelled with the file name, a filmstrip on video tracks and a waveform on audio; image clips are the same element, drawn by the preview's image cache); page `media.page` (`appPages`, icon `Images`), empty for now
- **Points it owns:** `librarySections` (`media.points.ts`): sections above the files (`composition` contributes its own).
- **API** (`useModule(mediaRef)` / `ctx.require(mediaRef)`): `probes`, `fileDrop`, `getProbe`,
  `waitForProbe`, `pictureMeta(id)` (size, frame rate, length as soon as ffprobe has read them, rotation included), `mediaUrl`, `animation(id)` (frames and rate of an animated image), `imageFrames(id, elapsed, ahead)` (the URLs of an image's picture at a moment and those after it, looped), `restore(assets)` (registers a saved project's files, marks those not found `missing`, returns them). `useLocateMedia()` asks where a missing file went and looks for the others in that folder. `mediaHasAudio(probe)` (exported helper) says whether a file has
  sound (true unless ffprobe found none). `createFakeMediaModule(probes)` (`media.testing.ts`) stands in for it
  in tests.
- **Exports:** `MEDIA_PAGE`, the id of the Media page, for `showPage`.
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
  - `media.drag.ts`: pointer-based drag of a `LibraryItem` (`{ type, id }`) to the timeline; drop targets listen for `MEDIA_DROP`.
  - OS file drop is handled in `setup` (Tauri's drag-drop event drives `fileDrop` and the overlay).
  - `ui/`: `MediaLibrary` (header, grid, empty state, drop hint/overlay), `MediaTile`,
    `MediaThumb`, `media.pick.hook.ts` (the file picker).
- **Not yet:** search, filters, folders, list view.

| Command           | MCP tool            | Notes                                                               |
| ----------------- | ------------------- | ------------------------------------------------------------------- |
| `media.import`    | `media_import`      | Tool waits until metadata is read                                   |
| `media.remove`    | `media_remove`      | Refuses while clips use the media                                   |
| `media.relink`    | `media_relink`      | Keeps its clips. `media.wrong_kind`                                 |
| `media.createBin` | `media_create_bin`  | In Master or inside `parentId`. `media.no_bin`                      |
| `media.renameBin` | `media_rename_bin`  | `media.no_bin`                                                      |
| `media.deleteBin` | `media_delete_bin`  | What it holds moves to its parent; nothing is lost                  |
| `media.moveToBin` | `media_move_to_bin` | Files and bins, into a bin or to Master (`null`). `media.bin_cycle` |
| —                 | `media_list`        | Media with metadata and status                                      |
