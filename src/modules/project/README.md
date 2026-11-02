# project

The project document: compositions, imported media, tracks and clips. Everything the user makes
lives here, so every change is undoable and readable by agents.

- **Tier:** core
- **Requires:** —
- **Contributes:** —
- **Points it owns:** —
- **API** (`useModule(projectRef)` / `ctx.require(projectRef)`): `store`, a patchable store of
  `ProjectState`. Read it freely; change it only through commands (`ctx.mutate`). Other modules edit
  it with their own commands. `view` says who has which composition open: `openFor(actor)`,
  `setOpen`, `closeTab`, `requireOpen` (throws `composition.none_open`), `formatFor`, `reset`. An actor whose
  composition is gone falls back to Main, then to none. `useOpenComposition()` and `useOpenFormat()`
  read it for the user.
- **Files:**
  - `project.types.ts`: `ProjectState`, `Composition`, `Track`, `Clip`, `ClipTransform`, `ClipPlacement`,
    `SharedGroupValues`. A `Clip` names its element in `kind` (`"media"`, `"text"`, a plugin's)
    and stores only the values that differ from the element's defaults in `props`; `mediaId` is
    set for clips that play a file; shared group values (`transform`) live under their own key.
  - `project.store.ts`: `DEFAULT_FORMAT`, `createEmptyProject()`.
  - `project.view.ts`: the view above. `project.testing.ts`: `seedProject(seed)`, one composition `c1` for test fixtures.
  - `logic/compositions.ts`: `contains(state, outer, inner)`, `settleCompositions` (the policy's `settle`, innermost first, inside every step: Extend to fit lengths, placements shortened to their composition, a transition that no longer fits removed with the left clip ending at the next one's start; it never moves a `start`).
  - `logic/fields.ts`: `projectPolicy`, the store's `StorePolicy`: what lets a step be undone past others' newer steps. `diff` lists changes by field (one level into plain objects; a created or deleted entity is one change), `repair` rebuilds `clipIds`, each `trackOrder`, `compositionOrder`, `mediaOrder`, `binOrder` and `solidOrder`, and `validate` refuses a missing Main, tracks without a composition, a composition inside itself, missing tracks or media, overlaps, stale junctions, two junctions on a cut, an item or bin pointing at a missing bin, and a bin inside itself.
  - `project.selectors.ts`: `orderedTracks(state, compositionId)`, `trackClips`, `clipEnd`,
    `compositionOf`, `compositionClips`, `compositionContent`, `placementsOf`, `formatOf(state, clip)`,
    `formatOfTrack`, `frameDuration`, `isMediaInUse`, `followsFileTime(state, clip)` (false for text and
    images, which have no time of their own).
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
  - `logic/ease.ts`, `logic/animate.ts`, `logic/content.ts`: keyframes, see below.
  - `createProjectModule(initial)` seeds the document in tests.
- **Invariants:** tracks, clips and junctions stay in flat records with project-wide ids, and a track belongs to one composition, so a clip or track id says which composition it means; track order is top → bottom (higher video tracks are drawn on top);
  `Track.clipIds` is sorted by `start` and clips on a track never overlap, except by `allowedOverlap` (junctions); times are microseconds;
  `Clip.transform` is optional (missing = fitted and centered): `x`/`y` offset of the picture's center
  from the frame's center in output pixels, `scale` relative to fit, `rotation` clockwise degrees.
  Video tracks hold pictures only; audio tracks hold sound (a video file's sound sits there as a
  clip of the same media). Clips sharing a `Clip.linkId` are linked (picture and sound of one
  video) and are edited together by the timeline until unlinked.
- **Junctions:** `ProjectState.junctions` holds things on the cut between two adjacent clips of one
  track (`Junction`: `kind`, `trackId`, `leftClipId`, `rightClipId`, `duration` = their overlap, `props`).
  Clips on a track overlap only by the `allowedOverlap` of the pair.
- **Saving:** `workspace` owns the file; `view.reset()` is what opening one calls.

| Command | MCP tool            | Notes                                                                          |
| ------- | ------------------- | ------------------------------------------------------------------------------ |
| —       | `project_get_state` | Whole document: each composition with its tracks, clips and `junctions` inline |

**Speed:** `Clip.speed` (`ClipSpeed`: `rate`, `pitchCorrection`, `reversed`) says how a clip plays its file; missing means normally. `Clip.duration` is the length on the timeline and the part of the file played is that at the rate (`sourceSpan`). `logic/speed.ts` holds `DEFAULT_SPEED`, `speedOf`, `sourceTimeAt` (the file's time at a timeline time, the only place a rate meets clip time), `elementTimeAt` (the same for a reversed copy), `canChangeSpeed` and `sameSpeed`. A `rate` of 0 holds one frame. The `speed` module owns the commands.

**Sound:** `Clip.sound` (`ClipSound`) says how a clip on an audio track sounds; missing means as the file does. `logic/sound.ts` holds `DEFAULT_SOUND`, `soundOf`, `dbToLinear`, `fadeLevel` and `pitchShift`, which preview and export share. The store policy keeps fades within their clip on every change. The `audio` module owns the commands.

**Keyframes:** `Clip.animation` (a record of `KeyTrack` by path: `transform.x`, `fontSize`, `outline.width`) and `Clip.animationOrigin` hold animated values; both are missing until something is keyed, and a clip without them plays, exports and saves as before. A `KeyTrack` has `blend` (`number`, `color` or `step`), `shared` (the value sits under its own clip key such as `transform`, not in `props`), `min`/`max` (copied from the property), `after` (`loop` or `pingpong`; missing holds the last value) and `keys` sorted by `t`. A `Keyframe` has `id`, `t`, `value`, `ease` (`KeyEase`, what happens on the way to the next key; missing means linear) and `smooth` (handles in line; the editor's concern only). Key times are content time, never timeline time. `logic/content.ts`: `contentTime(clip, time)` (time since the clip's first frame, from `animationOrigin`, scaled by the rate through `speedOf` but not through `sourceTimeAt`, so it runs forward on a reversed clip and keeps running on a held frame; not clamped), `timeOfContent` (its inverse) and `clampToClip` (a time within the clip's first to last microsecond). `logic/ease.ts`: `EASE_PRESETS` (Linear, Ease in, Ease out, Ease, Snap, Anticipate, Overshoot, Bounce, Elastic, Hold), `easeProgress(ease, u)` (a bezier's x is clamped to 0..1, its y is free; bounce and elastic are functions) and `presetOf(ease)` (exact match, else `"custom"`). `logic/animate.ts`: `trackValue(track, t)` (holds outside the keys, blends numbers and `#rrggbb` colors along the left key's ease, steps the rest, clamps to `min`/`max`, loops or ping-pongs after the last key) and `animatedClip(clip, time)` (the clip with every keyed value written in place; the same object when nothing is keyed; shared values can come out partial, which `clipTransform` fills from the identity). The engine calls `animatedClip` only in `resolveFrame` and `visibleLayers`.
