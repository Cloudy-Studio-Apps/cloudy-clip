# preview

Playback and the preview: the playhead, the engine that draws the timeline at the playhead, the
viewer (zoom and pan around the frame) and the preview panel with its transport bar.

- **Tier:** core
- **Requires:** `project`, `element` (how each kind of clip is drawn), `junction` (how the two
  clips of a junction are mixed), `media`, `fonts`
- **Speed:** an element plays at its clip's rate (`syncSlot` sets it each time, since loading a file resets it, and a released slot goes back to 1), and drift limits scale with the rate. A ramped clip plays at `rateAt(clip, time)` (`project`), set only when it moved by more than 0.01, its element is placed by `sourceTimeAt`, and a speed drag (`previewProps`) doesn't reach it. A clip without pitch correction gets the shift through the pitch worklet (`createSoundAtSpeed`). A reversed clip plays `reversedUrl`; until that copy is ready the clip is left out of the frame and `whenReversed` asks for a redraw. A held frame stays paused.
- **Keys:** `resolveFrame` puts `animatedClip(clip, time)` (`project`) in each active clip, and `animatedClip(clip, clip.start)` in each upcoming one, so the engine draws keyed values with no other change. A placement's inner frame is still found from the saved clip.
- **Disabled clips** are left out of `resolveFrame`; a junction beside one isn't active.
- **Contributes:** panel `preview.panel` (main); overlay `preview.fieldGuide` (`previewOverlays`: the field guide and corner marks, DOM only, so never in a capture or export); keybindings `preview.toggle-play` (Space),
  `preview.seek-start` (Home). Playback pauses when another page covers the editor
- **Points it owns:** `previewOverlays` (`preview.points.ts`): layers drawn over the frame, sized
  and moved with it, positioned in % of the frame (`transform` contributes its selection box). Each overlay's
  wrapper ignores the pointer (`pointer-events-none`); an overlay turns it back on for the parts
  that take input, so overlays stacked later never block the ones below
- **API** (`PreviewApi`, per kernel): `playback` (the user's clock), `clockFor(actor)` / `dropClock` (each collaborator has a `logic/virtual.clock.ts` playhead: wall-clock time read on demand, no frames, nothing drawn; commands use `clockFor(ctx.actor)` so an agent never moves the user), `attachCanvas`, `redraw`,
  `captureAt(time)` (`preview.capture.ts`: its own picture-only engine on a detached canvas, polled with timers because frames stop on a hidden window, disposed after 30 s idle; never touches the user's preview; an undecoded frame is an error, not a stale picture), `createRenderer({ project, compositionId, mediaUrl? })` (`preview.capture.ts`: a hidden picture-only engine at the composition's full size; `frameAt(time)` waits up to 30 s for every layer and returns RGBA bytes read with `getImageData`, which is what export sends to FFmpeg; the canvas keeps the same 2D context, never `willReadFrequently`; `project` is a snapshot, so later edits don't reach it), `measureVideoLevels(url)` (`preview.levels.ts`: what the canvas holds for video black and white; WebKitGTK squeezes the range, black at 15 and white at 236, while other layers are right, so `createRenderer`'s `videoLevels` corrects video layers only, through a lookup table in `engine.levels.ts`; the live preview doesn't, because reading every frame back is too slow to play), `previewTransform(clipId, transform | null)` (draws a live transform during a
  canvas gesture without changing the project), `previewProps(clipId, patch | null)`
  (a live patch of any element's values drawn over the saved ones until cleared; groups may be
  partial; a `transform` patch moves any picture, media included), `onPropsOverride(listener)` (fires on set/clear) and `propsOverride(clipId)` (so the
  canvas tools measure the picture being drawn), `viewport` (`store`, `zoomBy`, `panBy`, `fit`)
- **Files:**
  - `preview.clock.ts`: the playhead, driven by `requestAnimationFrame`; listeners are called per
    frame without React.
  - `engine/`: the v1 `PreviewEngine`. `engine.html.ts` renders and draws video layers bottom → top,
    each placed with `clipPlacement` (`project`); `engine.slots.ts` pools media elements (reused
    across clips of the same file, so splits play seamlessly; clips starting within 1.5 s are
    preloaded); `engine.sync.ts` keeps elements on the clock and re-seeks only on drift
    (`logic/drift.ts`). The clock moves during a seek and a seek flushes the sound (an audible
    tick), so a seek aims where the clock will be when it lands, using what the slot's last seek
    took (`seekCost`). A seek to the clock itself lands late on long-GOP files, stays over the
    limit and repeats every 500 ms.
    Elements are chosen by track kind: clips on video tracks get a `<video>` silenced with
    `volume = 0` (pictures only; WebKitGTK stops handing a `muted` video's frames to the canvas);
    clips on audio tracks get an `<audio>`, also for a video file's sound (same URL, sound only).
    Images never take a media element: `engine.images.ts` (`ImageCache`) keeps decoded stills and
    frames of animated images by URL, up to a pixel budget, and rasterizes SVGs once. `imageFrames`
    (`media`) names the picture at the clip's own time, looped, and the second ahead is loaded early, so a stretched GIF
    keeps moving; scrubbing moves it too. The engine waits for the picture like any other layer, and a broken one never blocks.
    Each clip is drawn as its element's `picture` says: `source: "media"` through a media element
    as above; any other element (text, a plugin's) with its own `draw(ctx, props, env)`, at
    `clipPlacement(format, size(props), transform, fit)`, the same box the canvas tools use. Props
    are the clip's resolved values with the live override merged over them. The transform is the
    gesture's (`previewTransform`) if any, else `clipTransform(clip, override.transform)`. `env.time` is the time since the clip started. A `picture.ready` that says no holds the frame like an undecoded video layer (`logic/readiness.ts`), and clips about to start are asked ahead so their art is loaded in time. `env.ensureFont` is
    `fonts.ensure`; the module redraws on `fonts.onLoaded`; `env.measure` is `canvasTextMeasure`
    (`element`) over the engine's canvas. An element without `picture` is not drawn. Swap engines by
    implementing `PreviewEngine` (`preview.types.ts`).
    **Junctions (the mixing hook):** during a junction's overlap a video track has two active
    clips. `engine.mix.ts` (`drawTrack`) draws each with the normal placement path into one of
    two pooled full-frame offscreen canvases (`MixCanvases`: default accelerated 2D canvases,
    never `willReadFrequently`), then calls the kind's `mix(ctx, a, b, progress, props, env)` on
    the main canvas in that track's place in the bottom → top order, inside `save`/`restore` in a `try/finally`: a mix that throws is logged
    once per engine and that frame shows the right picture over the left. `env` has the format,
    `kx`/`ky`, `elapsed` (seconds since the overlap started) and `random()`, a generator seeded by
    the junction id and re-created each frame (`logic/random.ts`), so noise is the same on every
    frame. A kind without `mix` (or a kind that isn't registered) draws nothing extra: the clips
    draw in start order, so the right covers the left. Nothing here is transition-specific;
    effects can reuse the hook later. The frame is painted only when both clips' frames are ready
    (rule 22). Each clip id has its own element (the pool only reuses a _free_ one), so the two
    halves of a split joined by a junction play at once; the right clip is preloaded from
    `start - 1.5 s` like any upcoming clip, and waiting pictures are silenced with volume 0, not
    `muted`, so their frame is drawable when the overlap starts. A split with no junction still
    reuses the warm element. `engine.audio.ts` sets each element's sound: linked sound clips
    overlapping under a junction get an equal-power crossfade (`soundGains`, `crossfadeGains` in
    `logic/junctions.ts`).
  - `logic/`: `junctions.ts` (`activeJunctions(project, trackId, time)`: overlapping junctions
    under the playhead with their `progress` and `elapsed`; `crossfadeGains(progress)`;
    `soundGains(project, composition, time)`), `random.ts` (`seededRandom(seed)`), `drift.ts`
    (`driftSeek(state)`: where to seek a playing element, or `null`).
  - `logic/frame.ts`: `resolveFrame(project, compositionId, time, options)`: a composition at a time as a tree, descending into placements at their local time (`sourceIn + time - start`). Every clip has a `path` of placement ids (`outer/inner`), because one original can be on screen twice: slots, needed sets and canvases key on it, never the bare clip id. A placement on a video track shows only pictures, on an audio track only sound; a hidden track shows nothing inside.
  - `engine/engine.nested.ts`: `NestedCanvases`: one transparent canvas per placement on screen (capped at the preview's size), with its own `MixCanvases`, since a transition inside a placement must not share canvases with one around it. Inner clips draw as saved: live gestures only touch the open composition. The background colour only fills the top level. Above 12 elements in a frame, inner clips are left out and the user is told once.
  - `preview.controller.ts`: wires clock, engine, project and media (injected, so it runs in
    node). It draws the composition the user has open (`project`'s `view`); an agent's clock runs on the length of its own open composition, and `captureAt(time, compositionId)` draws any composition. `logic/playheads.ts`: each composition keeps its playhead, restored on a switch. Renders every frame while playing, on demand while paused.
  - `preview.viewport.ts`: viewer zoom/pan state (view only, not undoable).
  - `ui/`: `PreviewStage` (frame + overlays, placed imperatively by `stage.layout.hook.ts`;
    Ctrl/Cmd + wheel zooms at the pointer, wheel and middle-drag pan via
    `stage.navigation.hook.ts`), `Transport` (`Timecode`, `PlayButton`, `ViewerZoom`).
  - Native (`src-tauri/src/webview`, Linux): WebKitGTK 2.54 repainted only part of the canvas
    layer on screen (a strip at the right of the video stayed black or showed an old frame, and
    sometimes the whole picture stayed black while audio played) although the canvas pixels were
    right. The webview turns WebKit's damage tracking off (`PropagateDamagingInformation`,
    `UseDamagingInformationForCompositing`); `CLOUDY_CLIP_WEBKIT_DAMAGE=1` keeps it, to check
    whether a WebKit update fixed it. A CPU canvas (`willReadFrequently`) is not an option: it
    draws video frames black.
- **Not yet:** safe zones, fullscreen, previous/next frame buttons.

| Command                                                 | MCP tool                        | Notes                                    |
| ------------------------------------------------------- | ------------------------------- | ---------------------------------------- |
| `preview.play` / `preview.pause` / `preview.togglePlay` | `preview_play`, `preview_pause` |                                          |
| `preview.seek`                                          | `preview_seek`                  |                                          |
| —                                                       | `preview_capture_frame`         | PNG of the preview, optionally at a time |
