# Keyframes

Any value of a clip can change over time, edited the way a professional expects: fold a clip open, see
its keys, switch to curves, pick a predefined curve or shape it by hand. Agents can do all of it too.

The approved look is the last mockup of the session, `keyframes-v4.html` (kept in
`.superpowers/brainstorm/keyframes/`, which git ignores; the sections below are the source of truth).

## Why

The user edits logo animations and custom transitions in After Effects, and fades in DaVinci Resolve, and
wants that here. Every value in the app is one number per clip today, so nothing can move. Motion graphics,
fades and speed ramps all wait on this.

## Goals

1. Opacity, transform, speed, blend and any other value of a clip can be keyframed, with no work per
   property.
2. The editing happens in the Edit page: a switch in the timeline toolbar goes between **Normal**,
   **Keyframes** and **Curves**.
3. The panel shows every selected clip, each folding open like a layer in After Effects, so keys of many
   clips can be selected and moved together.
4. Curves has handles, predefined curves and several properties in one graph.
5. Preview, `preview_capture_frame` and export agree on every frame.
6. Agents can do everything the user can, and undo it (`CLAUDE.md` idea 1).

## Non-goals

- Adjustment layers, custom transitions, picture effects, masks. Other sessions (the user's own scope:
  "only the animation").
- Expressions, parenting, and curved motion paths (position X and Y stay separate values, as in Resolve).
- A separate page. It was considered and refused: timing depends on the cut and the music around a clip.
- Animating text content, fonts, gradients or a sticker's variation. Values with no in-between that aren't
  enums or booleans can't be keyed.

## Anti-goals

- Fails if an untouched project plays, exports or saves differently. `animation` is absent until used.
- Fails if preview and export disagree about a value at a time.
- Fails if a user can't get back to the plain timeline in one press. Normal hides every keyframe tool.
- Fails if a key drag writes to the project on every move or re-renders React per frame (rules 15, 24).
- Fails if adding a new clip property needs keyframe code.

## Depends on

Two pieces of work come from other specs, and both keep their own plans:

- **Composite** (`2026-11-02-solids-composite-gradients-design.md`): opacity and blend don't exist yet.
  Stages 1 to 5 don't wait for it. Its fields become animatable by being declared, so it can land before or
  after. Test blend and opacity keys once it's in.
- **Clip speed** (`2026-11-02-clip-menu-and-speed-design.md`): `Clip.speed` and `sourceTimeAt` have landed, and
  Stage 7 waits for that plan's Preview/export, Freeze frame and Reverse tasks. That spec's non-goal "speed ramps, keyframes" is lifted
  by Stage 7, and its one-constant-speed rule stays true for any clip without a ramp.

## The value

Lives in `project`, because the engine (core) reads it, like `sound` and `transform`.

```ts
/** What a key does on the way to the next one. */
type KeyEase =
  | { kind: "linear" }
  | { kind: "hold" }
  | { kind: "bezier"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "named"; name: "bounce" | "elastic" };

interface Keyframe {
  id: string;
  /** Time on the clip's content, see below. */
  t: Micros;
  value: number | string | boolean;
  /** Missing means linear; ignored on the last key. */
  ease?: KeyEase;
  /** The handles on both sides of this key stay in line. */
  smooth?: true;
}

interface KeyTrack {
  /** How values blend: numbers and colors smoothly, everything else jumps. */
  blend: "number" | "color" | "step";
  /** The value is under its own key on the clip (`transform.x`), not in `props`. */
  shared?: true;
  /** Copied from the property, so a curve that overshoots stays in range. */
  min?: number;
  max?: number;
  /** After the last key. Missing means hold the last value. */
  after?: "loop" | "pingpong";
  /** Sorted by `t`, at least one. */
  keys: Keyframe[];
}

interface Clip {
  // …
  /** Keyed values by path (`transform.x`, `fontSize`, `outline.width`). Missing means none. */
  animation?: Record<string, KeyTrack>;
  /** Content time at the clip's first frame. Missing means 0. */
  animationOrigin?: Micros;
}
```

- **Why a map on the clip and not one object:** `projectPolicy` compares a record's fields one level deep,
  so a map of paths means undo conflicts are per property. An agent's undo isn't refused because the user
  keyed something else on that clip.
- **Why `shared`, `blend`, `min` and `max` are stored:** `project` can't read element declarations. The
  command that creates a track copies them from the property, so playback needs nothing else and a missing
  plugin can't break it.
- **Colors** are blended per channel on the stored `#rrggbb`, as the canvas shows them.
- **Enums and booleans** only ever hold. Blend's keys are the square kind.
- **Rotation** isn't normalized when keyed, so 0° to 720° is two turns. A static rotation still is.

## Time: keys stick to the picture

Key times aren't timeline times, or trimming would slide the animation under the picture.

```
contentTime(clip, time) = origin + (time - clip.start) * rate
```

For a clip without speed, that's `origin + time - clip.start`. It counts the file's time played since the
clip's first frame, always forward, so a reversed clip's animation still runs forward. A held frame (rate 0)
counts timeline time, so it can still animate. Then:

- **Moving a clip:** nothing changes.
- **Trimming the start by `delta`:** `animationOrigin` moves by the same amount the content does
  (`sourceIn`'s move, or `delta` for clips with no file). Keys stay on their picture.
- **Trimming the end:** nothing changes.
- **Splitting:** both halves keep every track, and the right half's origin moves by the offset. The curve
  stays continuous across the cut. Trimming a half back out finds its keys again.
- **Duplicating, pasting, `composition.group`:** the whole clip is copied, so `animation` comes along.
- **Constant speed:** keys are on the file's time, so they speed up with the picture.

Keys outside the clip's span still shape the curve. The panel draws them dimmed past the clip's ends, and
they can still be selected.

## One function for values

Like `clipPlacement()`, one pure function in `project` turns a clip into its values at a time:

`animatedClip(clip, time): Clip` returns the same object when there's no `animation`, or a shallow copy with
the keyed values in place. `clipTransform`, `clipComposite`, `element.resolve` and everything after them
don't change. Partial shared values are possible, so `clipTransform` merges over `IDENTITY_TRANSFORM`.

It's called in two places only:

- `preview/logic/frame.ts` (`resolveFrame`), so the engine, placements at any depth and export all get it.
- `transform/logic/layers.ts`, so the canvas tools hit-test what's drawn.

A live patch (`previewProps`) still wins over the curve during a drag. It's merged after.

Evaluation is deterministic and clamps to `min`/`max`. Between keys: `linear`, `hold`, a cubic bezier
(x clamped 0 to 1, y free, so it can overshoot), or the named functions. `bounce` and `elastic` are
functions because one bezier can't draw them. They show no handles. Dragging on them isn't possible until a
bezier preset is picked.

## Commands and tools

`element.setProps` gains an optional `at` (a timeline time). A patched path that's animated writes a key at
`at`, updating the key within half a frame, and otherwise inserting one with the neighbouring ease. Other paths
in the same patch stay static writes. Without `at` it's refused with `element.animated`, which names `keyframe_set`. So the inspector, canvas gestures and
agents all go through one command. The inspector and `transform` pass the playhead. This lives in `element`
because it's already the owner of writing values, and needs only `project`.

`element.resetProps` and `transform.reset` remove the tracks of the paths they reset. Otherwise a Reset
would leave the animation running.

`composition.setSettings`' resize rescales `transform.x`, `transform.y` and `scale` key values too, with
`scaleTransform`, as it does static transforms.

The new feature module owns the rest (`keyframe.*`, rule 10). All take times in timeline µs where it applies
and refer to keys as `{ clipId, path, keyId }`. All are undoable unless noted, validate everything first, and
a gesture sends one on release.

| Command               | MCP tool              | Does                                                                                                    |
| --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| `keyframe.set`        | `keyframe_set`        | Adds or updates a key: `clipId`, `path`, `at`, optional `value` (default the current value), `ease`     |
| `keyframe.remove`     | `keyframe_remove`     | Removes keys. The last key of a track leaves its value as the static value                              |
| `keyframe.move`       | `keyframe_move`       | Moves keys by `delta` as a group, each with an optional new value. A moved key replaces one it lands on |
| `keyframe.setValues`  | `keyframe_set_values` | Sets or offsets the values of keys (curves)                                                             |
| `keyframe.setEase`    | `keyframe_set_ease`   | Sets the ease of keys, with presets by name, and `smooth`                                               |
| `keyframe.scale`      | `keyframe_scale`      | Stretches keys around a pivot time, or reverses them with a negative factor                             |
| `keyframe.setAfter`   | `keyframe_set_after`  | Hold, loop or ping-pong after the last key                                                              |
| `keyframe.clear`      | `keyframe_clear`      | Removes tracks. The value at `at` becomes the static value                                              |
| `keyframe.copy`       | `keyframe_copy`       | Copies keys, per actor. Not undoable, touches no document                                               |
| `keyframe.paste`      | `keyframe_paste`      | Pastes at `at` onto `clipIds`, matching paths. `keyframe.no_target` if none fits                        |
| —                     | `keyframe_sample`     | Read-only: values of a path from `from` to `to` every `step`, so an agent can check a curve             |
| `keyframe.toggleMode` | —                     | Normal, Keyframes or Curves. Not undoable, no tool: it's the user's view                                |
| —                     | `keyframe_list_eases` | Read-only: every preset with its numbers                                                                |

Presets, in the strip's order: Linear, Ease in, Ease out, Ease, Snap, Anticipate, Overshoot, Bounce, Elastic,
Hold, and Custom when the handles match none. The list is closed for now, and lives in `project`
(`logic/ease.ts`) since `bounce` and `elastic` are needed at playback.

`project_get_state` shows `animation` as stored (rule 19). `element_describe` says which fields can be keyed.

## What can be keyed

`keyTargets` is a point the keyframe module reads: `{ id, fields(clip, track): KeyField[], afterWrite? }`.

- `keyframe` contributes the built-in target itself, from `element`'s `keyableFields(resolved)`: every field
  of the clip's resolved element and shared groups, by `PropKind`. `number` and `color` blend, `enum` and
  `boolean` step, and `string`, `custom` and `group` can't be keyed. `hidden` and `readOnly` fields are left
  out. A spec can opt out with `keyframes: false`.
- `audio` contributes `sound.volumeDb` and `sound.pan` (Stage 6), and `speed` contributes `speed.rate`
  (Stage 7), since they aren't element fields.
- `afterWrite(ctx, clipId)` runs inside the same command, so speed can re-solve the clip's length in the same
  undo step.

## The switch

A `SegmentedControl` at the left of the timeline toolbar: **Normal, Keyframes, Curves**. K flips between
Normal and the last keyframe view. Normal hides the panel, the preset strip and the motion path, and the
header goes back to its width. In Normal, selected clips show small diamonds on their bottom edge so a
clip's animation can be seen.

The clip's arrow also opens the panel, shown only on selected clips that have keys. `ClipActions` gains an
optional `badge(clip)` for it, so `timeline` draws both without knowing about keyframes.

## The panel

Sits under the tracks, in the Edit page. It's a dock with a dragged divider, and **Maximize** gives it the
whole timeline area (**Restore tracks** brings them back).

- **It lists every selected clip**, or every animated clip of the open composition with **Showing: all
  animated**. Each has a fold arrow and a summary row: a grey diamond for each time any of its properties has
  a key. Dragging one moves all keys at that time.
- **Only animated properties are rows**, plus any added from the inspector. A row has the name, the value at
  the playhead, previous key, add/remove key, next key.
- **It uses the timeline's scale and scroll**, so keys line up with the cuts above. Horizontal scroll is
  mirrored imperatively, and rows stay virtualized by pages (rule 26). **Fit** zooms the timeline to the
  selected clips, since a short clip would otherwise be tiny.
- **The header column widens** to 262 px while open, so names fit. `HEADER_WIDTH` stops being a constant for
  its 10 users (`timeline.setHeaderWidth`, read from the view).

**The keyboard while keys are selected:** when the last click was in the panel and keys are selected, Delete,
Ctrl+C and Ctrl+V act on keys, not clips. A click on the tracks gives them back. Otherwise pressing Delete to
remove a key would delete its clip.

**Selecting and moving:** click a key, Ctrl+click to add, drag empty space to box-select across clips,
**Select all keys**. Dragging any selected key moves them all, clamped as a group, snapped to frames and within
`SNAP_PX` of the playhead, clip edges and other keys. Alt-dragging a selection's end stretches it
(`keyframe.scale`). Copy and paste work on the selection, and a predefined curve applies to all of it.

Selection, fold state, the mode, Maximize, shown curves and the divider are per-kernel view state, never in
history (rule 16). Selected keys are held by `{ clipId, path, keyId }`.

## Curves

Same left column, with the graph in place of the rows.

- Each property has its own color and its own vertical scale, so X in pixels and opacity share a graph. Click
  a row to show or hide its curve. The last clicked is primary: it's drawn stronger, with its range on the
  left, and its selected keys show handles.
- Keys of different clips can be shown and box-selected together. Dragging moves in time and value, Shift
  locks to one axis.
- Blend and other stepped tracks aren't curves: their row stays, without a line.
- **Handles:** drag to shape the ease. On a `smooth` key the opposite handle turns to stay in line. Dragging a
  handle makes it `bezier`, and the strip shows Custom.
- **Toolbar:** Add key at playhead (on the primary row), Smooth handles, Copy, Paste, Select all, Fit, Motion path, Maximize.
- **Preset strip** at the bottom, in both Keyframes and Curves: thumbnails of each curve, applied to the
  selected keys, the current one marked in red.
- F9 applies Ease to the selection, as Easy Ease does in After Effects.

Curves draw on a canvas, redrawn only when the graph changes. The handle being dragged updates directly, and
one command goes on release.

## The inspector

- `keyframe` contributes a `fieldActions` entry, as the point was reserved for: the previous arrow, the diamond,
  and the next arrow. Empty when not animated, blue when animated, red and full on a key.
- The first press adds a track with a key at the playhead, and from then on the field is animated.
- Editing an animated field writes a key at the playhead (auto-key), through `element.setProps` with `at`. The
  canvas gestures do the same.
- Value color follows the prototype: blue while animated, red on a key.
- Values follow the playhead: `ClipSection` resolves `animatedClip(clip, playhead)`. A hook subscribes to the
  clock imperatively and re-renders at most 10 times a second while playing, and only when a value changes
  (rule 24).

## The motion path

A `previewOverlays` entry drawn when the panel is open: a dashed path of the selected clip's position sampled
over its span, with diamonds at keys. Dragging one on the canvas moves that key's value. It's DOM over the
frame, so it never reaches a capture or an export.

## Sound (Stage 6)

`sound.volumeDb` and `sound.pan` become key targets on audio clips. Preview reads them each frame with the
existing gains. Export builds a `volume` and pan envelope in `recipe.rs`, sampled from the same evaluator. Clip
fades stay as they are and multiply on top.

## Speed ramps (Stage 7)

Editing a ramp changes the clip's length, as the user asked: "the clip should get shorter".

- `speed.rate` is a key track whose keys sit on file time, like every other track. So rate is a function of
  the file, `rate(s)`, and `timeAt(s) = ∫ ds / rate(s)` has no circular dependency on the clip's length.
- `sourceTimeAt` looks through a table of that integral, one point per frame, built once per track
  (immer keeps the object stable, so a `WeakMap` caches it).
- `speed`'s `afterWrite` sets `duration = timeAt(out)`, rounded to `Micros`, and moves what follows with the
  same ripple rules as `speed.set`, with the last Ripple choice. All in one undo step.
- Rates stay 0.1x to 10x. Curves clamp to it.
- Because all tracks sit on file time, other keys move with the picture when a ramp changes.
- The panel converts file time to timeline time to draw any key on a ramped clip. Nothing else needs to know.
- **Preview:** `playbackRate` follows the ramp every frame.
- **Export:** frames use `sourceTimeAt`. Sound is cut into segments of constant tempo, short enough to hide the
  steps, through the existing `atempo` chain. Segment length is checked by ear in Stage 7.
- Reverse and Freeze: a reversed clip refuses a ramp with `speed.reversed_ramp`, and a frozen clip has no
  `speed.rate` target. A Freeze frame's hold bakes the values at that time, so the picture doesn't jump when
  it ends. `speed.set` on a ramped clip fails with `speed.ramped`.
- Linked picture and sound get the same ramp, as they get the same speed.

## Build order

Each stage ends working, with `pnpm typecheck`, `pnpm lint` and `pnpm test` passing and its README updated.

1. **Values and playback:** types, `ease`, `animate`, `keys`, content time, trim, split, resize, workspace,
   `resolveFrame`, canvas tools, `element.setProps` with `at`, the `keyframe` module with its commands and tools.
   An agent can animate, and export shows it.
2. **Inspector:** diamonds, auto-key, values at the playhead.
3. **Panel:** the toolbar switch, K, header width, dock, rows, several clips, selection, move, copy and paste, Fit,
   Maximize.
4. **Curves:** graph, handles, presets, F9.
5. **Extras:** motion path, stretch, reverse, loop and ping-pong, snapping.
6. **Sound:** volume and pan.
7. **Speed ramps:** after the clip speed project.

## File tree

`+` new, `~` changed. Rule numbers are `CLAUDE.md`'s.

```
CLAUDE.md                                ~ scope, Where to look, rules 13 and 35
docs/modules.md                          ~ tier table, points table
src/app/bootstrap.ts                     ~ lists keyframeModule, the only change in src/app

src/modules/project/                       core: the data and the maths, no UI
  project.types.ts                       ~ KeyEase, Keyframe, KeyTrack, Clip.animation, Clip.animationOrigin
  project.geometry.ts                    ~ clipTransform merges over the identity
  index.ts                               ~ exports the below, with TSDoc
  README.md                              ~
  logic/
    ease.ts            +                   presets, bezier and named curves
    ease.test.ts       +                   kernel of playback
    animate.ts         +                   valueAt, animatedClip
    animate.test.ts    +                   blends, hold, clamp, after, untouched clips
    keys.ts            +                   insert, update, sort, replace on landing
    keys.test.ts       +                   document integrity
    content.ts         +                   contentTime, timeOfContent, clampToClip
    ramp.ts            +                   Stage 7: the integral table, here because sourceTimeAt reads it
    ramp.test.ts       +                   Stage 7: inverse, length, bounds

src/modules/element/                       core
  element.commands.ts                    ~ setProps `at`, resetProps removes tracks
  element.guards.ts                      ~ element.animated
  element.types.ts                       ~ PropSpec.keyframes
  logic/keyable.ts     +                   which fields can be keyed, from PropKind
  element.mcp.ts                         ~ element_describe says what can be keyed
  index.ts                               ~
  README.md                              ~ removes "keyframes" from Not yet

src/modules/preview/                       core
  logic/frame.ts                         ~ animatedClip at local time
  README.md                              ~

src/modules/timeline/                      core
  timeline.points.ts                     ~ timelineTools, timelineDocks
  timeline.types.ts                      ~ their items, setHeaderWidth, dock state
  timeline.store.ts                      ~ headerWidth, dock height, tracks hidden
  timeline.layout.ts                     ~ HEADER_WIDTH becomes the default
  logic/placement.ts                     ~ left trim moves animationOrigin
  timeline.split.commands.ts             ~ right half keeps animation, origin moves
  ui/TimelinePanel.tsx                   ~ reads the points, header from the view
  ui/TimelineToolbar.tsx                 ~ reads timelineTools
  ui/Ruler.tsx, Playhead.tsx,
     TrackHeader.tsx, TrackInsert.tsx    ~ header from the view
  ui/TimelineClip.tsx                    ~ reads ClipActions.badge for the arrow and diamonds
  index.ts                               ~ README.md ~

src/modules/composition/
  composition.settings.commands.ts       ~ key values rescale with the frame
  logic/resize.ts                        ~
  ui/EndMarker.tsx                       ~ header from the view

src/modules/collab/ui/AgentPlayheads.tsx ~ header from the view

src/modules/workspace/
  logic/format.ts                        ~ version 3, `animation` kept; test on round trip

src/modules/inspector/
  logic/live.ts                          ~ commit passes `at`
  ui/props.live.hook.ts                  ~
  ui/ClipSection.tsx                     ~ values at the playhead
  ui/clip.values.hook.ts  +                clock subscription, at most 10 Hz, on change only
  README.md                              ~

src/modules/transform/
  ui/transform.gesture.ts                ~ commits with `at`
  logic/layers.ts                        ~ animatedClip at the time
  transform.commands.ts                  ~ reset removes tracks
  README.md                              ~

src/modules/audio/                         Stage 6
  audio.keys.ts        +                   keyTargets entry, volume and pan
  audio.module.ts                        ~ requires keyframe
  README.md                              ~

src/modules/speed/                         Stage 7, from the speed project
  speed.keys.ts        +                   keyTargets entry, afterWrite
  README.md                              ~

src/modules/export/
  logic/mixdown.ts                       ~ Stage 6 and 7: envelopes, tempo segments
src-tauri/src/export/recipe.rs           ~ Stage 6 and 7

src/modules/keyframe/                    + feature module, requires project, element, preview, timeline, inspector
  index.ts                                 public API, TSDoc on every export
  keyframe.ref.ts
  keyframe.module.ts                       wiring only
  keyframe.types.ts                        every type, including KeyframeApi
  keyframe.points.ts                       keyTargets
  keyframe.commands.ts                     lists the three below
  keyframe.edit.commands.ts                set, remove, move, setValues
  keyframe.ease.commands.ts                setEase, setAfter, scale
  keyframe.clipboard.commands.ts           copy, paste, clear
  keyframe.commands.test.ts                undo, order, clamps, last key, paste
  keyframe.guards.ts                       requireKey, requireField
  keyframe.mcp.ts                          the tools, commandTool wrappers and two reads
  keyframe.view.store.ts                   mode, selection, folds, shown curves, Maximize
  keyframe.layout.ts                       row height, panel header width, colors of curves
  README.md
  logic/
    range.ts                               what's shown at this scale, virtualization
    graph.ts                               value and time to pixels, per property scale
    handles.ts                             bezier to handle positions, smooth alignment
    picking.ts                             hit tests, box select
    snap.ts                                to frames, playhead, edges, keys
    motion.ts                              position path samples
  ui/
    index.ts                               what module.ts contributes
    ModeSwitch.tsx                         Normal, Keyframes, Curves
    KeyPanel.tsx                           the dock: left column, plane or graph
    PanelToolbar.tsx
    ClipGroup.tsx                          a clip's fold and summary row
    PropertyRow.tsx                        name, value, arrows, diamond
    KeyBand.tsx                            one row's keys
    KeyDiamond.tsx
    CurveGraph.tsx                         the canvas
    curve.draw.ts
    PresetStrip.tsx
    EaseThumb.tsx
    KeyAction.tsx                          the inspector's field action
    MotionPath.tsx                         the preview overlay
    key.gesture.ts                         move a selection
    box.gesture.ts                         box select
    handle.gesture.ts                      drag a handle
    panel.scroll.hook.ts                   mirrors the timeline's scroll
    panel.rows.hook.ts                     clips and rows on show
```

## Rule check

| Rule       | How the tree follows it                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 2, 3    | Each stage updates its READMEs. Tests only on the kernel of playback, document integrity and undoable commands, and `logic/range`, `graph` and `snap` get none |
| 4, 5       | The UI imports `@/core`, `@/ui` and modules' `index.ts`. Nothing in `src/core` or `src/ui` changes, and `bootstrap.ts` is the only file in `src/app` that does |
| 6          | No native access in `keyframe`. Sound goes through `export`, as now                                                                                            |
| 7          | One folder with all required files, listed in `src/app/bootstrap.ts`                                                                                           |
| 8          | `keyframe` is a feature. Core modules read `Clip.animation` as data and never import it. `timeline` offers the points, and doesn't know who fills them         |
| 9          | `requires` lists five modules, each used. `audio` and `speed` add `keyframe`                                                                                   |
| 10         | Commands, tools and UI live in `keyframe`, though the data is in `project`. `element.setProps` stays in `element`, since it's that command being extended      |
| 11, 12     | `keyframe.module.ts` is wiring. The view store is a factory, created in `setup`                                                                                |
| 13         | `keyTargets` lives in its reader, `keyframe`. `timelineTools` and `timelineDocks` live in `timeline`. Both go in rule 13                                       |
| 14, 15     | Every edit is a command, one per gesture on release. Failures use `CommandFailure("keyframe.<reason>", …)`                                                     |
| 16         | `animation` is in the project store. Selection and panel state are in the view store                                                                           |
| 17         | Key times are integer `Micros`, ids from `createId()`                                                                                                          |
| 18         | Tools live in `keyframe.mcp.ts`, snake case with the module prefix, thin `commandTool`s                                                                        |
| 19         | `animation` is on the clip, so `project_get_state` shows it                                                                                                    |
| 20 to 22   | Untouched. A keyed picture waits for its frame as any other                                                                                                    |
| 23         | Placement still comes only from `clipPlacement()`, fed by `animatedClip`. No `clip.kind` branch: fields come from declarations                                 |
| 24, 25, 26 | Drags update the DOM and the canvas directly. The inspector's hook re-renders on change. Rows are virtualized by pages. Selectors select slices                |
| 27, 28     | One component per file, dotted names, one-word `logic/`                                                                                                        |
| 29, 30, 31 | Types in `keyframe.types.ts` and `project.types.ts`, `logic/` is pure, TSDoc on exports, commands and tools                                                    |
| 32         | Failures come back as command results, or `notify`                                                                                                             |
| 33         | `SegmentedControl`, `ToolbarButton`, `IconButton`, `ContextMenu` from `@/ui`                                                                                   |
| 34         | Semantic tokens. Curve colors are named in `keyframe.layout.ts` from the token set                                                                             |
| 35         | Sharp shapes. **Curve handles are round, which rule 35 doesn't list yet: it gains "curve handles" next to EQ points**                                          |
| 36         | No seal needed                                                                                                                                                 |

## Tests

Only what rule 3 allows: ease and evaluation, keys staying sorted and unique, content time through trim and split,
the `keyframe.*` commands with undo, `element.setProps` with `at`, `workspace` round trip, and the ramp's inverse
in Stage 7. No tests for the panel, curves or gestures.

## Documentation

Each stage updates its module's README in the template. `CLAUDE.md`: scope, Where to look, rules 13 and 35.
`docs/modules.md`: the tier table and points table. `Clip.duration`'s comment if the speed project hasn't.

## Left to the builder

- Keyboard details beyond K and F9, and which key adds a key at the playhead.
- How the divider and Maximize animate, if at all.
- The dimming of keys outside a clip's span.
- Curve colors, within the tokens.
- File layout inside `keyframe`, within rules 27 to 30.

## Calls made without the user

- A separate new feature module, `keyframe`, with the data and maths in `project`.
- Keys stick to the picture, not the timeline, so trims don't slide an animation.
- Both halves of a split keep all keys, and keys outside a clip's span stay, dimmed.
- A moved key replaces one it lands on.
- Animated fields auto-key at the playhead when edited, as in After Effects. `element_set_props` needs `at` on them.
- Reset removes the animation of what it resets. Removing the last key leaves its value as static.
- Normal keeps small diamonds on selected clips only.
- Curves shows several clips' keys together, each property on its own vertical scale.
- Volume and pan are in, as Stage 6, under the user's "etc".
- Extras chosen for professional use: copy and paste, summary rows, stretch and reverse, loop and ping-pong, snapping,
  F9, motion path, `keyframe_sample`.
- Workspace version goes to 3. Older files open unchanged, and an older app refuses a newer file instead of
  dropping its animation on save.
