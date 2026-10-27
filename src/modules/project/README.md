# project

The project document: the output format, imported media, tracks and clips. Everything the user makes
lives here, so every change is undoable and readable by agents.

- **Tier:** core
- **Requires:** —
- **Contributes:** —
- **Points it owns:** —
- **API** (`useModule(projectRef)` / `ctx.require(projectRef)`): `store`, a patchable store of
  `ProjectState`. Read it freely; change it only through commands (`ctx.mutate`). Other modules edit
  it with their own commands.
- **Files:**
  - `project.types.ts`: `ProjectState`, `Track`, `Clip`, `ClipTransform`, `ClipPlacement`.
  - `project.store.ts`: `FORMAT_PRESETS`, `createEmptyProject()`.
  - `project.selectors.ts`: `projectDuration`, `orderedTracks`, `trackClips`, `clipEnd`,
    `isMediaInUse`, `formatPreset`.
  - `project.geometry.ts`: `clipPlacement(format, sourceSize, transform)`, the one place a clip's
    transform becomes a rectangle in the frame (the preview engine and the canvas tools both use it);
    `clipTransform`, `IDENTITY_TRANSFORM`, `normalizeRotation`.
  - `createProjectModule(initial)` seeds the document in tests.
- **Invariants:** track order is top → bottom (higher video tracks are drawn on top);
  `Track.clipIds` is sorted by `start` and clips on a track never overlap; times are microseconds;
  `Clip.transform` is optional (missing = fitted and centered): `x`/`y` offset of the picture's center
  from the frame's center in output pixels, `scale` relative to fit, `rotation` clockwise degrees.
  Video tracks hold pictures only; audio tracks hold sound (a video file's sound sits there as a
  clip of the same media). Clips sharing a `Clip.linkId` are linked (picture and sound of one
  video) and are edited together by the timeline until unlinked.
- **Not yet:** a project name, saving and loading.

| Command             | MCP tool             | Notes                                    |
| ------------------- | -------------------- | ---------------------------------------- |
| `project.setFormat` | `project_set_format` | `9:16`, `16:9`, `1:1`                    |
| —                   | `project_get_state`  | Whole document, tracks with clips inline |
