# preview

Playback and the preview canvas.

- `playback-clock.ts`: the playhead. Driven by `requestAnimationFrame` and `performance.now()`; listeners are called per frame without React.
- `engine/html-media-engine.ts`: the v1 `PreviewEngine`. Pools media elements (reused across clips of the same file, so splits play seamlessly), preloads clips starting within 1.5 s, re-seeks only on drift, and draws video layers bottom → top, letterboxed. Swap engines by implementing `PreviewEngine` (`preview.types.ts`).
- `preview.controller.ts`: `createPreviewController(deps)` wires clock, engine, project and media (injected, so it is tested in node). Renders every frame while playing, on demand while paused.
- **API** (`PreviewApi`, per kernel): `playback` (the clock), `attachCanvas`, `redraw`, `captureFrame`.
- Tier: core. Requires: `project`, `media`. Contributes: panel `preview.panel` (main); keybindings `preview.toggle-play` (Space), `preview.seek-start` (Home).

| Command                                                 | MCP tool                        |                                          |
| ------------------------------------------------------- | ------------------------------- | ---------------------------------------- |
| `preview.play` / `preview.pause` / `preview.togglePlay` | `preview_play`, `preview_pause` |                                          |
| `preview.seek`                                          | `preview_seek`                  |                                          |
| —                                                       | `preview_capture_frame`         | PNG of the preview, optionally at a time |
