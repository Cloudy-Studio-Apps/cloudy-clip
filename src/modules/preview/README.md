# preview

Playback and the preview: the playhead, the engine that draws the timeline at the playhead, the
viewer (zoom and pan around the frame) and the preview panel with its transport bar.

- **Tier:** core
- **Requires:** `project`, `media`
- **Contributes:** panel `preview.panel` (main); keybindings `preview.toggle-play` (Space),
  `preview.seek-start` (Home)
- **Points it owns:** `previewOverlays` (`preview.points.ts`): layers drawn over the frame, sized
  and moved with it, positioned in % of the frame (`transform` contributes its selection box)
- **API** (`PreviewApi`, per kernel): `playback` (the clock), `attachCanvas`, `redraw`,
  `captureFrame`, `previewTransform(clipId, transform | null)` (draws a live transform during a
  canvas gesture without changing the project), `viewport` (`store`, `zoomBy`, `panBy`, `fit`)
- **Files:**
  - `preview.clock.ts`: the playhead, driven by `requestAnimationFrame`; listeners are called per
    frame without React.
  - `engine/`: the v1 `PreviewEngine`. `engine.html.ts` renders and draws video layers bottom → top,
    each placed with `clipPlacement` (`project`); `engine.slots.ts` pools media elements (reused
    across clips of the same file, so splits play seamlessly; clips starting within 1.5 s are
    preloaded); `engine.sync.ts` keeps elements on the clock and re-seeks only on drift. Swap engines
    by implementing `PreviewEngine` (`preview.types.ts`).
  - `preview.controller.ts`: wires clock, engine, project and media (injected, so it is tested in
    node). Renders every frame while playing, on demand while paused.
  - `preview.viewport.ts`: viewer zoom/pan state (view only, not undoable).
  - `ui/`: `PreviewStage` (frame + overlays, placed imperatively by `stage.layout.hook.ts`;
    Ctrl/Cmd + wheel zooms at the pointer, wheel and middle-drag pan via
    `stage.navigation.hook.ts`), `Transport` (`Timecode`, `PlayButton`, `ViewerZoom`,
    `FormatPicker`).
- **Not yet:** safe zones, fullscreen, previous/next frame buttons, export.

| Command                                                 | MCP tool                        | Notes                                    |
| ------------------------------------------------------- | ------------------------------- | ---------------------------------------- |
| `preview.play` / `preview.pause` / `preview.togglePlay` | `preview_play`, `preview_pause` |                                          |
| `preview.seek`                                          | `preview_seek`                  |                                          |
| —                                                       | `preview_capture_frame`         | PNG of the preview, optionally at a time |
