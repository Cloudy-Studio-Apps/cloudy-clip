# Masks and track mattes

Date: 2026-11-19. Status: design, approved approach B (hybrid: shapes on the 2D canvas, feather and
brightness mattes on the GPU).

## Intent

The owner used masks in After Effects for two things: **transitions** (a shape moves, grows or sweeps
across a clip to reveal or hide it) and **cut-outs** (showing only part of a clip so it sits better in
a composition). Cloudy Clip has neither today: the only masking in the code is private to two
transition presets (`dissolve`, `wipe`). The owner wants it "easy to use but as powerful as a
professional editor": CapCut on the surface, After Effects underneath, like the rest of the app.

A future **motion tracker** must be able to drive masks without a rewrite, and the owner wants
"flexibility per point": every point of a drawn mask animates on its own.

The owner also asked for **track mattes**: one track's picture decides where a clip shows (video
inside big letters; a brush-stroke clip revealing the next shot).

## Goals

1. Any picture clip (media, text, sticker, solid, composition) on a video track can hold any number of
   **masks**, applied in order, each combined with the ones before by a mode.
2. **Easy surface:** a Mask tab with ready-made shapes (Linear, Mirror, Ellipse, Rectangle, Star,
   Heart). One click adds one centered on the picture; drag it on the canvas with handles.
3. **Pro underneath:** masks drawn with the **pen** or **freehand** (the path module's tools); per
   mask: mode (Add, Subtract, Intersect, Difference), invert, opacity, feather, expansion, on/off,
   name, color; a preset can be **converted to points**.
4. **Everything animates:** every number of a mask is keyable, including **each point and each of its
   handles on its own**. A "Path" diamond keys the whole shape at once (After Effects' Mask Path).
5. **Track matte:** a clip names a video track of its composition as its matte, by **alpha** or
   **brightness** (luma), optionally inverted. The matte track stops drawing itself.
6. Preview, frame capture and export draw masks and mattes through **one path**, so they always agree.
7. Agents can do all of it (rules 14, 18, 19), and every edit is one undo step.

## Non-goals (this round)

- Motion tracking itself. The data is shaped for it (see "For the tracker").
- Masks on Tint corrections (power windows). Tint's `limit` left room; it reuses this geometry later.
- AI masks, subject selection, rotobrush.
- Variable-width feather per point (After Effects' Mask Feather tool), mask motion blur.
- Copying and pasting masks between clips (agents can read `mask_list` and `mask_add`). Later.
- A "show matte track" switch. The matte's effect is visible, and its clips stay selectable from the
  timeline with their transform box.
- A `shape` element. A solid with a mask is a shape layer.

## Anti-goals (a failure even if it works)

- The outline on the canvas and the drawn mask disagree by even a pixel at any zoom.
- The preview and the export differ (a mask present in one and not the other, a different feather).
- The canvas outline or handles show up in a capture or an export.
- A mask edit that isn't one undo step, or an agent that can't do what the UI does.
- React state on the drag path (rule 24): mask drags repaint in the DOM and through the live override.
- A second copy of the Bézier editing code. Masks reuse the path module's pieces (memory: reuse before
  new code).

## Constraints from the codebase

- WebKitGTK has no usable `ctx.filter` (transition ruling R1; Woosh fakes its blur). A true Gaussian
  feather has to run on the GPU runner (`preview/gpu`, WebGL2, owned by the engine, already used by Tint).
- The engine already paints a clip that isn't Normal at 100% on a scratch layer
  (`MixCanvases.layer()`) and lands it once with `landLayer` (`engine.html.ts` `drawClip`,
  `engine.composite.ts`). Masks and mattes cut that layer before it lands.
- Layering: `preview` is core, `mask` is a feature. As with `composite` (types in `project`, drawn by
  the engine, edited by `transform`), the data and pure geometry live in `project`, the engine draws
  from the data, and the `mask` feature owns commands, MCP tools, UI and the key target.
- Keyframe paths are dotted object paths (`animatedClip` → `withPath(path.split("."))`), so anything
  keyed by id must sit in records, not arrays (as Tint's `grade.nodes.<id>`).
- `PathPoint` is `{ x, y, inX, inY, outX, outY }`, cubic Béziers; `path/logic/edit.ts` and `fit.ts`
  hold the editing and stroke-fitting math; `path/ui` holds the point/handle overlay and the
  freehand/pen gestures.
- Project files are versioned (`workspace/logic/format.ts`, now 5, written lower when a feature isn't
  used).

## Approaches considered

- **A. Canvas only.** Shapes, combining and feather on the 2D canvas, feather faked by shrink/stretch,
  brightness by reading pixels on the CPU. No GPU needed, but large feathers band and step, and
  CPU readback at 1080p/4K stutters playback. Rejected: not professional quality.
- **B. Hybrid (chosen).** Shapes rasterized with `Path2D` on the 2D canvas (exact, any curve, the same
  geometry as the overlay), combined with canvas compositing; only Gaussian feather and luma→alpha run
  on the existing GPU runner. Professional quality, fast, built on existing pieces. Needs WebGL2, which
  fails like Tint does.
- **C. All in shaders.** Exact analytic feathers, but many-point Béziers in a shader are hard to make
  match the canvas outline, far more code, and a matte must still be drawn first. Rejected.

## The design

### 1. Data (owned by `project`)

On `Clip` (picture clips on video tracks only):

```ts
/** Masks by id; `maskOrder` is the order they apply in (first to last). Missing means none. */
masks?: Record<MaskId, ClipMask>;
maskOrder?: MaskId[];
/** The track whose picture decides where this clip shows. Missing means none. */
matte?: ClipMatte;
```

```ts
interface ClipMask {
  id: MaskId;              // createId("mask")
  name: string;            // "Mask 1", unique per clip by default, editable
  color: MarkerColor;      // its outline on the canvas; cycles MARKER_COLORS
  on?: false;              // missing = on
  mode: "add" | "subtract" | "intersect" | "difference";
  invert?: true;
  opacity: number;         // 0..1
  feather: number;         // 0..2000, picture px (Gaussian radius ≈ 2σ)
  expansion: number;       // -2000..2000, picture px; grows (+) or shrinks (−) the shape
  x: number; y: number;    // the mask's center in the picture, px from the picture's center
  rotation: number;        // degrees, normalized like transform's
  shape: MaskShape;
}

type MaskShape =
  | { kind: "rectangle"; width: number; height: number; roundness: number } // roundness 0..1 of the short side's half
  | { kind: "ellipse"; width: number; height: number }
  | { kind: "star"; width: number; height: number; points: number; inner: number } // 3..24, rounded; inner 0.05..1
  | { kind: "heart"; width: number; height: number }
  | { kind: "linear" }                       // half-plane: shows below the line through (x, y) at `rotation`
  | { kind: "mirror"; width: number }        // a band of `width` centered on that line
  | { kind: "path"; scale: number; points: Record<PointId, PathPoint>; pointOrder: PointId[] }; // closed, ≥ 3 points, relative to (x, y)

interface ClipMatte {
  trackId: TrackId;          // a video track of the clip's composition, not the clip's own
  by: "alpha" | "luma";
  invert?: true;
}
```

- **Space:** a mask lives in its clip's **fitted picture space**: output px from the picture's center,
  with the picture as `clipPlacement` fits it at the identity transform (contained for media, natural
  size for text), before the clip's own transform. Moving, scaling, rotating, flipping the clip, or
  following a motion path, carries its masks, as in After Effects. This space depends only on the
  picture's aspect, never its pixel count, so a proxy in the preview and the master in export map a
  mask identically, and the engine needs no probe sizes. `maskPlacement(format, size, transform)`
  (`project`) gives the one mapping: the clip's placement center and rotation, and per-axis factors
  `placed / fitted` (signed by the flip). The engine and the canvas use only it.
- **Resizing a composition with scale** scales every mask length (`x`, `y`, sizes, `feather`,
  `expansion`, point coordinates, and their keys) by `min(kx, ky)`, beside `scaleTransform`, with the
  same shortcut comment about aspect changes.
- **Defaults** of a new preset: centered (0, 0), rotation 0, size half the fitted picture's (the
  Mask tab passes it, from the layer on screen; a command given no size uses half the frame, so
  commands never need probes or text measuring), feather 0, expansion 0, opacity 1, mode Add. Linear starts horizontal through
  the center; Mirror at a quarter of the picture's height.
- **Never stored empty:** an empty `masks` drops both fields; `matte` is dropped with its track.
- **Pure geometry** in `project/logic/mask.ts`: `maskOutline(mask)` → closed cubic
  segments in fitted picture px (rectangle with rounded corners, ellipse as 4 Béziers, star, heart, path with
  `scale`, `rotation`, `(x, y)` applied), and `maskLine(mask)` for linear/mirror (a point and a normal).
  The engine rasterizes from this, and the overlay draws from this, so they cannot disagree.
- **Validation** (`projectPolicy.validate`, like paths): `maskOrder` matches the keys of `masks`; ranges;
  a path shape has ≥ 3 points and `pointOrder` matches `points`; `matte.trackId` is a video track of the
  same composition (its own track is allowed in the document and ignored by the engine, so moves never fail). **Settle:** deleting a track drops every `matte` naming
  it in the same step (as ducks' `listensTo`).
- **Clips that move:** split copies masks and matte to both halves (keys sit in content time, so
  they follow). Freeze frame bakes the masks at the frozen moment like every other value of the hold
  (`animatedClip`, keys dropped) and keeps the matte. Paste into the same composition keeps the matte; into another drops it.
  Duplicating a composition remaps `matte.trackId` to the copied track (`composition/logic/clone.ts`,
  as it does for paths). Grouping clips into a new composition (which copies the tracks it needs and leaves the
  originals) points a matte at the copy of its track when one is made, else drops it, and the
  command's result and a toast say which clips lost their matte.
- **Own track and chains:** `mask.setMatte` refuses the clip's own track (`mask.own_track`), a track
  whose clips have mattes, or a clip that sits on a matte track (`mask.matte_chain`). Moves and pastes
  are never refused for it; instead the engine ignores a matte that names the clip's own track, and a
  clip on a matte track ignores its own matte. So a timeline edit can't fail because of a matte, and
  nothing chains.
- **File version 6**, written only when a clip has masks or a matte (`usesMasks` beside `usesPaths`).
- **`project_get_state`** lists, per clip, `masks` (in order: id, name, kind, mode, on/invert when set,
  animated fields) and `matte`.

### 2. Keys (owned by `mask`, a `keyTargets` contribution)

Key paths, all `shared` numbers with the ranges above:

- `masks.<id>.opacity | feather | expansion | x | y | rotation`
- `masks.<id>.shape.width | height | roundness | points | inner` (by kind)
- `masks.<id>.shape.scale`, and per point `masks.<id>.shape.points.<pid>.x | y | inX | inY | outX | outY`

Folded in the keyframe panel and `keyframe_list_fields` as one group per mask ("Mask 1"); point
fields are labeled "Point 3 · X" inside it (the group is one level today, and nesting isn't worth
changing `keyframe` for). `commitStatic` writes through `mask.update` / `mask.setPoints`, like Tint's.

- **The Path diamond** (Mask tab, path masks): keys every coordinate of every point at the playhead in
  one step (`keyframe.setMany`). That is After Effects' Mask Path, on top of per-point tracks.
- **Editing an animated path:** if any coordinate of a mask's points has keys, dragging a point (or a
  handle) on the canvas keys that point's six coordinates at the playhead; other points are untouched.
  This is the "flexibility per point".
- **Adding a point to an animated path** keeps every keyed shape: the new point gets keys at every key
  time of the mask's points, placed by de Casteljau on the segment at the same `t`, and the neighbors'
  handles are keyed to match at each of those times. **Removing a point** drops its tracks.
- **Converting a preset to points** writes the outline as a path; if the preset's numbers had keys, the
  points get keys at the union of those key times (each the outline at that time) and the preset keys go.

**For the tracker:** a tracker (later) writes ordinary keys: a mask's `x`/`y`/`rotation`/`scale` for a
point or planar track, or per-point coordinates for corner pin and roto, through `keyframe.writeSpan`.
Nothing about masks changes when it arrives.

### 3. Drawing (owned by `preview`'s engine)

Per clip in `drawFrame`'s `drawClip`, when the clip has an enabled mask or a matte (or isn't Normal at
100%), paint it on the scratch layer as today, then:

1. **Masks → one alpha canvas `M`** (frame-sized, from the `MixCanvases` pool). Start transparent, or
   opaque if the first enabled mask's mode is Subtract or Intersect (After Effects' rule). For each
   enabled mask in order:
   - Rasterize its shape into a scratch alpha canvas `S` with the clip's placement matrix (the same one
     `land` uses: `clipPlacement` + rotation + flip, × `kx`/`ky`): fill the outline opaque; expansion
     strokes the outline with `lineWidth = 2|e|` and round joins, adding (+) or cutting (−); linear and
     mirror are filled half-planes/bands offset by the expansion. Invert: fill all, cut the shape.
   - Feather > 0: blur `S`'s alpha on the GPU (separable Gaussian, x and y radii from the feather × the
     clip's effective scale on each axis × `kx`/`ky`). Large radii blur at a reduced size (σ ≤ ~16 px at
     that size) and scale back up; a mask is smooth, so nothing is lost.
   - Combine onto `M` at `globalAlpha = opacity`: Add `source-over`; Subtract `destination-out`;
     Intersect `destination-out` of the inverted `S`; Difference `xor` (exact for hard edges; for soft
     ones it reads as "where exactly one shows", the builder may refine).
2. **Matte → `T`:** drawn **before the track loop** of `drawFrame`, never inside `drawClip`
   (drawing a track with junctions reuses `MixCanvases`' `a`/`b` slots, which may hold the left
   picture of a junction being mixed), into its own canvas outside those slots: the matte track drawn at this time into a frame-sized canvas, through `drawTrack`
   with the normal `drawClip` (its clips' transforms, keys, masks, composites, junctions, motion paths
   all apply; its own clips' `matte` is ignored, so no chains or cycles). Drawn **once per frame per
   track per nesting level** and reused by every clip that names it. Alpha: used as is. Luma: one GPU
   pass, `alpha = luma(rgb) × a` (Rec.709). Invert: used with `destination-out` instead of `-in`.
3. Cut the layer: `destination-in` with `M`, then with `T` (or `destination-out` for an inverted alpha
   matte), then `landLayer` with the clip's mode and opacity, unchanged.

- **The matte track doesn't draw itself:** in `drawFrame`, a video track named by any clip's `matte` in
  that composition is skipped like a hidden one. Hiding it (eye) changes nothing about the matte, so
  the frame-ready checks in `prepare()` (which skip hidden tracks today) must wait for a matte track's
  frames even when it is hidden (rule 22), in the preview and in export. Its disabled clips don't count. No clip on the matte track at that time means an empty matte (alpha:
  nothing shows; inverted: everything shows).
- **Junctions:** masks and matte apply to each clip's picture before the junction mix.
- **Placements (nested compositions):** each composition's `drawFrame` resolves its own mattes.
- **`only` captures** (Tint stills and matching read a clip's own picture) skip masks and matte.
- **Bypass** (`bypassFilters`, Tint's compare): masks and mattes still apply. They aren't filters, so
  their GPU passes run whether or not `filtering` is on.
- **Picking:** `transform`'s `visibleLayers` marks clips on a matte track (`matte: true`); a canvas
  click doesn't pick them (they aren't drawn), but selected from the timeline they still get their box.
- **Caching:** a clip's `M` may be kept while its masks, placement and canvas size are unchanged and
  nothing is animated (builder's call; correctness first).
- **No WebGL2 / GPU failure:** as Tint's filters. In the live preview a feathered mask draws hard-edged
  and a luma matte is used as alpha, and the user is told once per kernel; a capture or export rejects
  with a clear error instead of writing a wrong picture.
- **Live edits:** a drag sends its live values through the existing `previewProps(clipId, patch)`
  override under the `masks` key, merged over the saved masks for that frame (as `transform` and
  `follow` are); release sends one command.

### 4. The `mask` feature module (`src/modules/mask/`)

- **Tier:** feature. **Requires:** `project`, `element` (which kinds draw a picture), `keyframe` (`keyTargets`, `setMany`), `preview`
  (playhead, `previewProps`, viewport), `inspector` (`inspectorTabs`, `propertyControls`, `FieldRow`),
  `timeline` (selection, `timelineTrackControls`), `path` (the shared Bézier editing pieces, see
  below), `transform` (`useVisibleLayers`, the selected clip's picture size and placement on screen,
  and `hideBox(owner, hidden)`, a new `TransformApi` call that hides its box while a mask is edited;
  `transform` never knows about `mask`).
- **UI store** (per kernel, not in history): `selectedMaskId`, `selectedPointId`, `drawing`
  (`{ mode: "freehand" | "pen" }` while a new path mask is drawn).

**Commands** (one undo step each; `<module>.<action>`; `CommandFailure` codes `mask.clip_not_found`,
`mask.not_picture`, `mask.not_found`, `mask.point_not_found`, `mask.animated` (a keyed field without
`at`), `mask.invalid`, `mask.track_not_found`, `mask.own_track`, `mask.not_video`):

| Command | MCP tool | What |
| --- | --- | --- |
| `mask.add` | `mask_add` | `clipIds` (all picture clips), a preset `kind` with optional values, or `points` for a path; optional `mode`, `name`, `feather`… Returns `maskIds` by clip. |
| `mask.update` | `mask_update` | `clipId`, `maskId`, a partial patch (any field but `id` and the path's points); `at` for keyed fields (as `element.setProps`). |
| `mask.setPoints` | `mask_set_points` | The whole point list of a path mask (ids kept for existing points, new ones made), `at` when keyed. Also how insert/remove on the canvas commit (keys kept as in §2). |
| `mask.convert` | `mask_convert` | A preset to a path mask (§2). |
| `mask.remove` | `mask_remove` | `clipId`, `maskIds`, with their key tracks. |
| `mask.reorder` | `mask_reorder` | `clipId`, `maskId`, `index`. |
| `mask.setMatte` | `mask_set_matte` | `clipIds`, `trackId` or `null`, `by`, `invert`. |
| (read) | `mask_list` | A clip's masks in order with their point ids and their values at `at` (default your playhead), and its matte. |

**Inspector: the Mask tab** (`inspectorTabs`, picture clips on video tracks):

```
┌ Mask ──────────────────────────────────────────┐
│ [None][Linear][Mirror][Ellipse][Rect][Star][♥] │  presets: adds to every selected clip
│ [Pen] [Freehand]                               │  draws a path mask
│                                                │
│ ● Mask 1   Add ▾   ◐ invert  👁  ⋮             │  rows: color, name (dbl-click rename),
│ ● Mask 2   Subtract ▾        👁  ⋮             │  mode, invert, on, menu (convert, delete,
│                                                │  up/down); click selects it on the canvas
│ ─ Mask 1 ───────────────────────────────────── │
│ Position   X 0      Y 0                    ◇   │  every row has its diamond
│ Size       W 960    H 540                  ◇   │
│ Rotation   0°                              ◇   │
│ Roundness  20%                             ◇   │  (by kind)
│ Feather    0 px                            ◇   │
│ Expansion  0 px                            ◇   │
│ Opacity    100%                            ◇   │
│ Path       12 points                       ◇   │  path masks: the whole-shape diamond
│                                                │
│ ─ Track matte ──────────────────────────────── │
│ Matte      None ▾ (V1, V3…)                    │
│ Use        [Alpha][Brightness]   Invert ☐      │
└────────────────────────────────────────────────┘
```

"None" removes the clip's masks (one step). With several clips selected, presets and the matte apply to
all; the mask list shows only with one clip.

**Canvas overlay** (`previewOverlays`, DOM only, never captured):

- Every mask of the selected clip outlined in its color; the selected mask editable. While a mask is
  selected the transform box hides; Escape or a click on empty space deselects the mask.
- **Presets:** drag inside to move; corners scale (Shift keeps proportions, Alt from the center), sides
  stretch one axis, a top handle rotates (Shift: 15°), a **feather handle** (a small double arrow just
  outside the bottom edge, as CapCut) drags the feather, a corner dot drags roundness (rectangle), an
  inner dot drags `inner` (star). Linear: a center dot moves, a handle rotates, the feather handle
  softens. Mirror: also two edge handles for its width.
- **Path masks:** points and Bézier handles as the motion-path overlay (select, drag, Alt breaks the
  handle pair, double-click on the line inserts, Delete removes while ≥ 4 points stay; a drag inside the
  shape moves the whole mask by its `x`/`y`).
- **Drawing:** Pen and Freehand as the path module's drawing (close by clicking the first point for the
  pen; freehand closes on release); the result is one `mask.add` with `points`, then it's selected.
- Every drag repaints in the DOM and the engine through `previewProps`, and sends one command on release
  with `at` = the playhead (a keyed field gets a key there). Escape cancels. Failures are toasts.

**Timeline:** a `timelineTrackControls` badge on a track used as a matte ("Matte for: <clip names>").

**Reuse from `path`** (no copy): the pure Bézier editing (`movePart`, `insertPoint`, `nearestOnPath`,
`removePoint`, `segmentAt`) and `fitStroke` move to `project/logic/` beside `path.ts` (they are path
geometry, which `project` already owns), and the point/handle overlay and the freehand/pen gestures are
generalized in `path` to take points and commit callbacks, exported from `path`'s `index.ts`, and used
by both the motion path and masks. Those take `PathPoint[]` with indices in frame px, so `mask`
converts at its edge: records + `pointOrder` ⇄ array, a fresh id for a point `insertPoint` adds, and
a picture ⇄ frame mapping (from the clip's placement) handed to the overlay and the gestures.

### 5. Agents

All commands above as tools; `mask_list` and `project_get_state` make every mask readable; mask keys
appear in `keyframe_list_fields` and work with every `keyframe_*` tool. `preview_capture_frame` shows
the result. Tool descriptions say masks live in picture px from the picture's center.

## Left to the builder

- The exact rounded-rectangle, star and heart outlines (a heart: two arcs and a point, as Béziers).
- Kernel size and downscale thresholds of the blur; caching of `M` and `T`.
- Difference's soft-edge formula, if `xor` reads wrong.
- Thumbnails for the preset buttons (`lucide-react` icons are fine).
- Which existing tests to extend and which to add (rule 3: integrity and undo only).

## Tests (rule 3 only)

- Document integrity: validation of masks and matte; settle drops a matte when its track goes; paste
  into another composition drops it; composition duplicate remaps it; split keeps masks on both halves.
- Undo: each mask command is one step and undoes cleanly.
- Keys: inserting a point into an animated path leaves every keyed shape unchanged; converting an
  animated preset keeps its shape at each key time.
- No canvas tests (Vitest runs without a DOM); the geometry in `project/logic/mask.ts` is checked through
  the conversion test.

## Done means

`pnpm typecheck`, `pnpm lint`, `pnpm test` pass; READMEs of `project`, `preview`, `path`, `transform`,
`keyframe`, `workspace` and the new `mask` updated; `bootstrap.ts` lists `mask`; changelog entries as the
other features have. A live check in the app: a feathered ellipse, a subtract ring, an animated
pen mask, a text luma and alpha matte over video, a mask inside a nested composition, and an export
that matches the preview.
