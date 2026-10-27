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
    preloaded); `engine.sync.ts` keeps elements on the clock and re-seeks only on drift.
    Elements are chosen by track kind: clips on video tracks get a `<video>` silenced with
    `volume = 0` (pictures only; WebKitGTK stops handing a `muted` video's frames to the canvas);
    clips on audio tracks get an `<audio>`, also for a video file's sound (same URL, sound only). Swap engines by implementing `PreviewEngine` (`preview.types.ts`).
  - `preview.controller.ts`: wires clock, engine, project and media (injected, so it is tested in
    node). Renders every frame while playing, on demand while paused.
  - `preview.viewport.ts`: viewer zoom/pan state (view only, not undoable).
  - `ui/`: `PreviewStage` (frame + overlays, placed imperatively by `stage.layout.hook.ts`;
    Ctrl/Cmd + wheel zooms at the pointer, wheel and middle-drag pan via
    `stage.navigation.hook.ts`), `Transport` (`Timecode`, `PlayButton`, `ViewerZoom`,
    `FormatPicker`).
  - Native (`src-tauri/src/webview`, Linux): WebKitGTK 2.54 repainted only part of the canvas
    layer on screen (a strip at the right of the video stayed black or showed an old frame, and
    sometimes the whole picture stayed black while audio played) although the canvas pixels were
    right. The webview turns WebKit's damage tracking off (`PropagateDamagingInformation`,
    `UseDamagingInformationForCompositing`); `CLOUDY_CLIP_WEBKIT_DAMAGE=1` keeps it, to check
    whether a WebKit update fixed it. A CPU canvas (`willReadFrequently`) is not an option: it
    draws video frames black.
- **Not yet:** safe zones, fullscreen, previous/next frame buttons, export.

| Command                                                 | MCP tool                        | Notes                                    |
| ------------------------------------------------------- | ------------------------------- | ---------------------------------------- |
| `preview.play` / `preview.pause` / `preview.togglePlay` | `preview_play`, `preview_pause` |                                          |
| `preview.seek`                                          | `preview_seek`                  |                                          |
| —                                                       | `preview_capture_frame`         | PNG of the preview, optionally at a time |
