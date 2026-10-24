# media

Importing files, reading their metadata, and the library panel.

- **Native side** (`src-tauri/src/media`): `media_register` validates paths and adds them to an id → path allowlist; a loopback HTTP server streams them with Range support (`media_server_url`).
- **Probing** (`media.probe.ts`): a bounded queue loads each file in a hidden media element to read duration/size and a poster frame. Results live in `mediaProbeStore` (not undoable). A file that cannot be decoded gets `status: "error"` with a reason; it never throws.
- **Drag to timeline** (`media.drag.ts`): pointer-based; drop targets listen for `MEDIA_DROP`.
- **OS file drop**: handled in `activate` via Tauri's drag-drop event.

| Command        | MCP tool       |                                   |
| -------------- | -------------- | --------------------------------- |
| `media.import` | `media_import` | Tool waits until metadata is read |
| `media.remove` | `media_remove` | Refuses while clips use the media |
| —              | `media_list`   | Media with metadata and status    |
