# media

Importing files, reading their metadata, editing proxies, and the library panel (the rail's Media
tab), from which media is dragged onto the timeline.

- **Tier:** core
- **Requires:** `project`
- **Contributes:** panel `media.library` (side, icon `SquarePlay`)
- **Points it owns:** —
- **API** (`useModule(mediaRef)` / `ctx.require(mediaRef)`): `probes`, `fileDrop`, `getProbe`,
  `waitForProbe`, `mediaUrl`. `createFakeMediaModule(probes)` (`media.testing.ts`) stands in for it
  in tests.
- **Files:**
  - Native side (`src-tauri/src/media`): `media_register` validates paths into an id → path
    allowlist; a loopback HTTP server streams them with Range support (`media_server_url`).
  - Proxies: pro/camera formats (ProRes, APV, 10-bit HEVC, high bitrates, 24-bit PCM, …) get a light
    H.264 copy made with the system FFmpeg. Progress arrives as `media://proxy` events and is stored
    in `probe.proxy`. Without FFmpeg, files are played directly.
  - `media.service.ts`: the native calls and the proxy listener.
  - `media.probe.ts`: once the proxy state settles, a bounded queue loads each file in a hidden
    media element to read duration, size and a poster. Results live in `probes` (per kernel, not
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
