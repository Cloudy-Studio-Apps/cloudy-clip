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
  - `project.types.ts`: `ProjectState`, `Track`, `Clip`, `ClipTransform`, `ClipPlacement`,
    `SharedGroupValues`. A `Clip` names its element in `kind` (`"media"`, `"text"`, a plugin's)
    and stores only the values that differ from the element's defaults in `props`; `mediaId` is
    set for clips that play a file; shared group values (`transform`) live under their own key.
  - `project.store.ts`: `FORMAT_PRESETS`, `createEmptyProject()`.
  - `project.selectors.ts`: `projectDuration`, `orderedTracks`, `trackClips`, `clipEnd`,
    `isMediaInUse`, `formatPreset`.
  - `project.geometry.ts`: `clipPlacement(format, sourceSize, transform)`, the one place a clip's
    transform becomes a rectangle in the frame (the preview engine and the canvas tools both use it);
    `clipTransform(clip, live?)` (the saved transform or the identity, with a live patch merged
    over it), `IDENTITY_TRANSFORM`, `normalizeRotation`. The fit (`contain` for media,
    `none` for text at its natural size) comes from the clip's element.
  - `logic/links.ts`: `partnersOf`, `withPartners` (linked clips, moved here from the timeline).
  - `logic/junctions.ts`: junction data rules. `junctionBetween`, `junctionsOfClip`,
    `allowedOverlap(state, left, right)` (the junction's duration, also for the linked sound pair on
    another track, else 0), `rippleMoves`, `applyMoves` (pure, keeps `clipIds` sorted),
    `findLayoutConflict`, `staleJunctions`.
  - `createProjectModule(initial)` seeds the document in tests.
- **Invariants:** track order is top → bottom (higher video tracks are drawn on top);
  `Track.clipIds` is sorted by `start` and clips on a track never overlap, except by `allowedOverlap` (junctions); times are microseconds;
  `Clip.transform` is optional (missing = fitted and centered): `x`/`y` offset of the picture's center
  from the frame's center in output pixels, `scale` relative to fit, `rotation` clockwise degrees.
  Video tracks hold pictures only; audio tracks hold sound (a video file's sound sits there as a
  clip of the same media). Clips sharing a `Clip.linkId` are linked (picture and sound of one
  video) and are edited together by the timeline until unlinked.
- **Junctions:** `ProjectState.junctions` holds things on the cut between two adjacent clips of one
  track (`Junction`: `kind`, `trackId`, `leftClipId`, `rightClipId`, `duration` = their overlap, `props`).
  Clips on a track overlap only by the `allowedOverlap` of the pair.
- **Not yet:** a project name, saving and loading.

| Command             | MCP tool             | Notes                                                                            |
| ------------------- | -------------------- | -------------------------------------------------------------------------------- |
| `project.setFormat` | `project_set_format` | `9:16`, `16:9`, `1:1`                                                            |
| —                   | `project_get_state`  | Whole document, tracks with clips inline, plus `junctions` (by track, then time) |
