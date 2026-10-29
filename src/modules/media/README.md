# media

Importing files, reading their metadata, editing proxies, and the library panel (the rail's Media
tab), from which media is dragged onto the timeline.

- **Tier:** core
- **Requires:** `project`, `element`
- **Contributes:** panel `media.library` (side, icon `SquarePlay`); element `media`
  (`media.element.ts`: no own properties, supports `transform`, `picture: { fit: "contain",
source: "media" }`, labelled with the file name, a filmstrip on video tracks and a waveform on audio)
- **Points it owns:** —
- **API** (`useModule(mediaRef)` / `ctx.require(mediaRef)`): `probes`, `fileDrop`, `getProbe`,
  `waitForProbe`, `mediaUrl`. `mediaHasAudio(probe)` (exported helper) says whether a file has
  sound (true unless ffprobe found none). `createFakeMediaModule(probes)` (`media.testing.ts`) stands in for it
  in tests.
- **Files:**
  - Native side (`src-tauri/src/media`): `media_register` validates paths into an id → path
    allowlist; a loopback HTTP server streams them with Range support (`media_server_url`).
  - Proxies: pro/camera formats (ProRes, APV, 10-bit HEVC, high bitrates, 24-bit PCM, …) get a light
    H.264 copy made with the system FFmpeg. Progress arrives as `media://proxy` events and is stored
    in `probe.proxy`, with `hasAudio` once ffprobe has read the streams. Without FFmpeg, files are
    played directly.
  - `media.service.ts`: the native calls and the proxy listener.
  - `media.probe.ts`: once the proxy state settles, a bounded queue loads each file in a hidden
    media element to read duration, size and a poster (the element is silenced with `volume = 0`,
    not `muted`: WebKitGTK draws a muted video's frames to a canvas as black). Results live in `probes` (per kernel, not
    undoable). A file that can't be decoded gets `status: "error"` with a reason; it never throws.
  - `media.drag.ts`: pointer-based drag to the timeline; drop targets listen for `MEDIA_DROP`.
  - OS file drop is handled in `setup` (Tauri's drag-drop event drives `fileDrop` and the overlay).
  - `ui/`: `MediaLibrary` (header, grid, empty state, drop hint/overlay), `MediaTile`,
    `MediaThumb`, `media.pick.hook.ts` (the file picker).
- **Not yet:** search, filters, folders, list view.

| Command        | MCP tool       | Notes                             |
| -------------- | -------------- | --------------------------------- |
| `media.import` | `media_import` | Tool waits until metadata is read |
| `media.remove` | `media_remove` | Refuses while clips use the media |
| —              | `media_list`   | Media with metadata and status    |
