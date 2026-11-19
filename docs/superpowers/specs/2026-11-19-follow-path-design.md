# Follow path: clips that travel along a drawn curve

## Why

The owner is making animated scenes (a 2D character video): a seal jumps from a rock, arcs through
the air and lands in the water. Today a clip's position is only X and Y keyed separately, each
interpolated on its own, so an arc needs many keys and comes out stiff or wobbly. The owner wants
to draw the curve once, say "start at 0 s, end at 2 s", and have the program work out every
position. As a professional editor they also want one path to drive several clips (three birds on
one curve), so changing the curve once changes every follower, instead of recreating or editing
each clip's keys.

This is the motion path of After Effects / GSAP's MotionPath / Blender's Follow Path constraint.
It is **not** motion tracking (following something in footage); that is a separate, later feature.

## Goals

- Draw a path on the canvas, **freehand** (default: one stroke, turned into a few smooth editable
  points) or with a **pen** (click for corners, drag for curve handles). Both produce the same
  editable points.
- A path belongs to a composition and can be followed by **any number of picture clips** (video,
  photo, text, sticker, solid, placed composition: anything on a video track).
- Each follower has **Progress** (0–100 %, keyable). Attaching a clip writes two Progress keys for
  it (0 % at its start, 100 % at its end); the existing ease presets, curves, loop and ping-pong
  apply to Progress.
- **Even speed**: equal Progress covers equal distance along the curve (arc length), so a clip
  doesn't rush through tight bends. Easing comes only from the Progress keys.
- **Position becomes an offset** from the path point while following, so followers can sit side
  by side on one curve; X/Y keys keep working on top (a bob).
- **Orient along path** (per follower, off by default): the curve's direction is added to Rotation.
- Editing a path moves every follower; one edit is one undo step.
- Everything a user can do, an agent can do (MCP), undoable.

## Non-goals

- Animating or transforming the path itself (a path that moves); a path as a clip on a track.
- Drawing the path's line in the picture (a visible stroke), text on a path.
- Motion tracking, rotoscoping.
- Per-point speed control (After Effects' roving keys); speed comes from Progress keys only.
- A clip following more than one path at once.
- Paths shared between compositions.

## Anti-goals

- The canvas box, the tint picker, the in-place text editor and the export disagreeing about where
  a follower is (rule 23).
- Deleting a path, or detaching a clip, making clips jump.
- Saved projects, existing keys or agent calls changing meaning: a clip without `follow` plays
  exactly as today.
- Any edit (draw, reshape, attach, detach, delete) taking more than one undo step.

## Approaches considered

- **A. The path belongs to the composition** (a document record per path, listed in the Library,
  never rendered); clips point to it from a Follow path section. **Picked.** Gives sharing,
  editing once, timing with keys the user already knows, per-clip offsets. Its gap (the path can't
  move or animate) can be added later without redoing anything.
- **B. The path is a clip on a track** (After Effects null / Blender curve object). Can be moved
  and animated with its followers, but it is a clip that renders nothing, has a confusing time
  span, and makes every picture depend on another clip's animation (engine, export, picking).
- **C. Draw, then bake into X/Y keys.** Cheapest, but no live link: changing the curve means
  redoing every clip, the exact time sink the owner wants gone. Dropped.

Drawing: the owner picked **both** freehand and pen; freehand is the default.

## The model

In `project` (types, validation, geometry), like markers:

- `ProjectState.paths?: Record<PathId, MotionPath>` (missing in old projects = none).
- `MotionPath { id, compositionId, name, closed: boolean, points: PathPoint[] }`, at least two
  points.
- `PathPoint { x, y, inX, inY, outX, outY }`: the point in output pixels from the frame's center
  (same space as `transform.x/y`), and its two handles as offsets from the point (0, 0 = a
  corner). A smooth point has opposite handles; a broken one doesn't (no flag stored; the editor
  decides symmetry while dragging).
- The segments are cubic Béziers between consecutive points (and last → first when `closed`).

A follower stores its settings in a new shared group `follow` at `clip.follow`
(`{ pathId, progress, orient }`, missing = not following), applying to clips on video tracks:

| Field      | Meaning                                                     | Default | Keyable |
| ---------- | ----------------------------------------------------------- | ------- | ------- |
| `pathId`   | The path followed; empty = none                             | none    | no      |
| `progress` | Where on the path, by distance, shown as % (range −10…10, slider 0–100 %) | 0 | yes |
| `orient`   | Add the path's direction (degrees, 0 = pointing right)      | false   | no      |

Progress outside 0–1: an open path holds its ends; a closed path wraps, so 0 → 300 % is three
laps (and loop/ping-pong repeats work too).

## Where a follower is (one function)

A pure function in `project` turns a path and a progress into a point and a direction:
`pathPointAt(path, progress) → { x, y, angle }`, measured by arc length (a length table per path,
cached per path object). A second one resolves a clip at a time against the document:
the clip as drawn = `animatedClip(clip, time)`, then, when it follows an existing path,
`transform.x += point.x`, `transform.y += point.y`, and with `orient` `rotation += angle`.

Every place that computes where a picture sits uses that resolved clip, so they all agree:
the engine's `resolveFrame` / `visibleLayers` (preview and export), `transform/logic/layers.ts`
(the canvas box), `tint.pick.ts`, the text editor's box. `clipPlacement` itself is unchanged.
A `follow.pathId` pointing at a missing path (a damaged file) is ignored: the clip plays at its
offset.

The keyframe module's X/Y motion-path overlay hides for a clip that follows a path (the path
overlay replaces it).

## Commands and tools (a new feature module `path`)

| Command       | MCP tool      | Does                                                                                        |
| ------------- | ------------- | ------------------------------------------------------------------------------------------- |
| `path.create` | `path_create` | A path in a composition (default: the actor's open one) from points, `closed`, `name`        |
| `path.update` | `path_update` | Replace points, rename, open/close. Every follower moves with it                             |
| `path.remove` | `path_remove` | Many ids, all or none. Followers are detached in the same step, baked (below)                |
| `path.attach` | `path_attach` | Clips follow a path: sets `follow`, keys Progress 0 % / 100 % at each clip's ends (unless it already has Progress keys), zeroes the static X/Y (X/Y keys are kept as offsets) |
| `path.detach` | `path_detach` | Clears `follow`, baked (below)                                                               |
| (read)        | `path_list`   | Paths of a composition with their points and followers                                      |

**Baking** (detach, delete): the path point and (with orient) the angle at `at` (default the
actor's playhead, clamped to the clip) are added to the static X/Y/Rotation and to every X/Y/
Rotation key, and the Progress keys are removed, so the clip stays where it was at that moment.

`element.setProps` / `keyframe_*` work on `follow.progress` and `follow.orient`. `follow.pathId` is
a `readOnly` field: it changes only through `path.attach` / `path.detach` (attaching to another
path is an attach; it keeps the existing Progress keys), so no route makes a clip jump.

Errors: `path.not_found`, `path.composition_not_found`, `path.too_few_points`,
`path.other_composition` (attaching to a path in another composition), `path.not_picture`,
`path.clip_not_found`.

Composition interplay: deleting a composition deletes its paths; duplicating one, or Make unique,
copies its paths and points the copied followers at the copies; Group into composition copies each
path its moved followers use into the new composition (so the grouped birds keep flying; the copy
is a separate path from then on); frame resize scales path points like it scales X/Y; pasting or
moving a follower into another composition detaches it (baked). Copying, repointing and baking are
pure functions on document data in `project` (like markers), so `composition` (core) uses them
without requiring the `path` feature.

## The UI

- **Library**: a **Paths** section (`librarySections`) listing the open composition's paths:
  New path (starts drawing), rename, delete, and the follower count. Selecting one shows it on the
  canvas.
- **Inspector**: a **Follow path** section on the video tab, under Transform:
  Path (a picker of the composition's paths, plus "None" and "Draw new path…", which draws and
  attaches in one step), Progress (slider, %, with its diamond), Orient along path (checkbox).
- **Canvas** (`previewOverlays`): the path shows (a line in `stroke-primary`, its points and, for
  the selected point, its handles) when it is selected in the Library or a selected clip follows
  it. Drag a point or a handle; a handle drag keeps the opposite handle in line unless Alt is held
  (breaks it); double-click a segment adds a point; Delete removes the selected point (not below
  two); release sends one `path.update`.
- **Drawing** (an overlay mode, entered from the Library or the Follow path picker): freehand by
  default (press, draw, release: the stroke is fitted into a few Bézier points with handles), or
  pen (a toggle while drawing: click adds a corner, click-drag pulls its handles, clicking the
  first point closes, Enter/double-click finishes, Escape cancels). Finishing sends one
  `path.create` (and `path.attach` when started from a clip, in the same undo step).
- DOM overlay only: never in a capture or export.

## Who changes

- `project`: types, schema/validation of `paths` and `follow`, `pathPointAt`, the resolve
  function, README, the geometry test (document integrity: arc length, closed wrap, offset,
  orient; rule 3).
- New module `path` (feature): commands, MCP tools, the `follow` shared group, the Library
  section, the inspector picker control, the overlay, drawing, freehand fitting; README; listed in
  `bootstrap.ts`.
- Callers that compute placement: `preview` (`logic/frame.ts`), `transform` (`logic/layers.ts`),
  `tint` (`tint.pick.ts`), `text` (`TextEditor.tsx`): use the resolved clip.
- `keyframe`: hide the X/Y motion path for followers.
- `composition`: delete/duplicate/resize/paste as above.
- CHANGELOG (English and Spanish) under Unreleased.

## Calls made after the builder check

Each marked as the designer's call.

- **`pathId` only through attach/detach.** It is `readOnly` in the `follow` group, so
  `element.setProps` can't change it; the inspector's picker sends `path.attach` / `path.detach`
  (a command control, like Flip). Switching to another path is an attach and keeps the Progress
  keys.
- **Dragging a follower on the canvas edits its offset.** Position is the offset while following,
  so the move gesture commits `resolved − path point` (and the rotate gesture, with orient,
  `resolved − angle`); the picture stays under the pointer and doesn't jump on release. Snapping
  works on the resolved box as today. Scrubbing Progress by dragging along the path is not in
  this version.
- **Group / Make unique** as in Composition interplay above.
- **A dangling `pathId` is invalid in the document.** The project's validation rejects a follower
  whose path is missing, so an undo that would leave one (undoing `path.create` after someone
  attached clips) is refused as a conflict. Loading a damaged file drops such `follow` entries
  (the clip stays at its offset) instead of refusing to open.
- **Progress range** −10…10 (−1000 %…1000 %), slider 0–100 %, so laps can be typed and keyed.

## Left to the builder

- How the resolve function receives the paths (a parameter, a selector) as long as it is one
  function every placement caller uses.
- The freehand fitting algorithm (e.g. Schneider's Bézier fitting) and its tolerance; no new
  dependency for it.
- Arc-length table resolution and caching.
- The exact look of points, handles and the drawing cursor (kit tokens, sharp shapes; rules 34/35).
- How the picker control is contributed (`propTypes` / `propertyControls`).
