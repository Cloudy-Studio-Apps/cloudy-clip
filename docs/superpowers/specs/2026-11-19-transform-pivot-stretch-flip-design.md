# Transform: pivot, stretch and flip

## Why

Bouncier gestures (squash and stretch) and turning a character to face the other way. Today a
picture only has a uniform scale and a rotation, both about its center. The owner wants this to
work like a professional editor, and picked the After Effects model.

## How professional editors do it

| Program         | Pivot            | X/Y scale                       | Flip                                        |
| --------------- | ---------------- | ------------------------------- | ------------------------------------------- |
| After Effects   | Anchor Point X/Y | Scale, linked or not            | Negative scale; Flip menu multiplies by −1  |
| Final Cut Pro   | Anchor X/Y       | Scale All, Scale X, Scale Y     | Scale X = −100                              |
| Premiere Pro    | Anchor Point     | Uniform Scale off: Width/Height | Horizontal Flip effect, or Scale Width −100 |
| DaVinci Resolve | Anchor Point X/Y | Zoom X/Y, linked                | Flip H/V buttons                            |
| CapCut          | none             | uniform only                    | Mirror button                               |

## Goals

- A **pivot** that rotation and scale (and stretch) happen about, settable in the panel, on the
  canvas and by agents, keyframable.
- **Stretch**: separate Width and Height factors, keyframable, so a bounce is two keyed values.
- **Flip** the After Effects way: a flip is a negative Width or Height, so a turn can animate
  smoothly through zero; Flip H / Flip V buttons negate it in one step.
- Everything a user can do, an agent can do (MCP), and it is undoable.

## Non-goals

- Linking Width and Height with a lock (Scale already is the uniform one).
- Crop, 3D (pitch/yaw), skew, motion blur.
- Per-element pivots or flips outside the shared `transform` group.

## Anti-goals

- Saved projects, existing `transform.scale` keys, text presets or agent calls changing meaning.
- The box on the canvas and the drawn picture disagreeing (rule 23: one `clipPlacement`).
- Moving the pivot on the canvas making the picture jump.

## Approaches considered

- **A. Flip as two on/off switches** (Resolve, CapCut). Easy to read; a keyed flip snaps, a
  smooth turn needs Width keyed to near 0 plus the switch.
- **B. Flip as negative stretch only** (Final Cut). One value animates through zero; no buttons, a
  flipped clip just reads "Width −100%".
- **C. Negative stretch plus Flip buttons** (After Effects). B's storage with A's buttons.
  **Picked by the owner.**

For scale, keeping `scale` and adding `scaleX`/`scaleY` factors was chosen over replacing `scale`
with an X/Y pair, because the replacement would need a migration of saved projects, keys, presets
and agents for no gain to the user (Scale stays the uniform one, like Final Cut's Scale All).

## The model

`ClipTransform` (in `project`) gains four fields; missing means the identity, so old projects
read unchanged:

| Field              | Meaning                                                                                                                | Default | Range    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| `x`, `y`           | Where the **pivot** sits, offset from the frame's center (output px)                                                   | 0       | ±100000  |
| `scale`            | Uniform size relative to fit                                                                                           | 1       | 0.01–20  |
| `scaleX`           | Width factor; negative is flipped horizontally                                                                         | 1       | −20…20   |
| `scaleY`           | Height factor; negative is flipped vertically                                                                          | 1       | −20…20   |
| `rotation`         | Clockwise degrees                                                                                                      | 0       | as today |
| `pivotX`, `pivotY` | Pivot in the picture, as a fraction of its size from its center (0 = center, −0.5 = left/top edge); may lie outside it | 0       | ±10      |

The panel shows `scaleX`/`scaleY`/`pivotX`/`pivotY` as % (×100), like Scale.

With the pivot at the center, `x`/`y` mean exactly what they mean today.

**Placement.** `clipPlacement()` stays the one place this is computed. With `f` the fit factor,
`w = source.width·f·scale·|scaleX|`, `h = source.height·f·scale·|scaleY|`, the pivot's offset from
the picture's center in the picture's own (unrotated, mirrored) axes is
`p = (pivotX·w·sign(scaleX), pivotY·h·sign(scaleY))`, and the picture's center is the pivot's
position minus `p` rotated by `rotation`:

```
cx = W/2 + x − (p.x·cos θ − p.y·sin θ)
cy = H/2 + y − (p.x·sin θ + p.y·cos θ)
```

`ClipPlacement` keeps `cx, cy, width, height, rotation` (width and height non-negative) and gains
`flipX`, `flipY` (booleans, from the signs). A width or height of 0 (a turn passing through zero)
draws nothing and can't be picked. Because the pivot is folded into `cx, cy`, every consumer of a
placement gets it for free; only flip needs consumers to change.

## Who changes

- **`project`**: the type, `IDENTITY_TRANSFORM`, `clipPlacement`. The geometry test gains the
  pivot, stretch and flip cases (document integrity, rule 3).
- **Drawers** mirror after rotating (`scale(flipX ? −1 : 1, flipY ? −1 : 1)`): the engine's `land`
  (video), `text.draw.ts`, `sticker.draw.ts`, `solid.element.ts`.
- **`tint/logic/pick.ts`**: `pictureAt` mirrors `u`/`v` when flipped, so the color picker reads the
  pixel under the pointer.
- **`text/ui/TextEditor.tsx`** and **`text.draw.ts`**: stretch on both axes (see Calls below).
- **`composition/logic/resize.ts`**: pivot-aware (see Calls below).
- **`transform`**:
  - `transform.group.ts`: the new props, the layout:
    Position (X, Y) · Scale · Width/Height row · Rotation · Pivot (X, Y) row · Flip buttons.
  - `transform.commands.ts`: `transform.flip` (`clipIds`, `axis: "x" | "y"`): negates `scaleX` or
    `scaleY` and every key of `transform.scaleX`/`transform.scaleY`, so the whole clip mirrors; one
    undo step; `transform.clip_not_found` like `reset`. `transform.reset` already drops every
    `transform.` key, so it resets the new fields too.
  - `transform.mcp.ts`: `transform_flip`. `reset`'s description lists the new fields.
  - `transform.menu.ts`: Flip horizontally / Flip vertically next to Reset transform.
  - Panel: the flip row is a `{ command: "transform.flip", control: "choices" }` item (one button
    per axis).
  - `logic/gestures.ts`: scale and rotate pivot about the placement's pivot point (not its center);
    a new `stretchTransform` for side handles (one axis, from the pivot); a new `pivotTransform`
    that moves the pivot and compensates `x`/`y` so the picture stays put.
  - `logic/picking.ts`: unchanged (works on the placement).
  - `ui/`: side handles on the box (hidden when the element `except`s `scaleX`/`scaleY`); a pivot
    crosshair (hidden without `pivotX`/`pivotY`); gesture modes `stretch` and `pivot`; the live
    feedback and the one-command-on-release rule as today. The box doesn't mirror; the handles
    stay where they are on screen.
  - `README.md` updated in the template.
- **Docs**: `project` README (transform fields), `text`/`tint` README lines where they describe the
  placement, the CHANGELOG (English and Spanish) under Unreleased.

## Canvas behavior

- Corner: uniform scale about the pivot (as today, but about the pivot).
- Side (left/right, top/bottom): stretch that one axis about the pivot. Dragging past the pivot
  flips (the value goes negative), as in After Effects.
- Top handle: rotate about the pivot; Shift snaps 15° as today.
- Pivot crosshair: drag to move the pivot; `x`/`y` are adjusted so the picture doesn't move. Release
  sends one `element.setProps` with the pivot and position (and `at`, so animated fields key at the
  playhead).
- In the panel, typing a pivot value moves the picture (After Effects' Anchor Point field does the
  same); only the canvas drag compensates.

## Calls made after the builder check

Each follows the After Effects model the owner picked; marked as the designer's call.

- **Text stretches.** `text.draw.ts` scales by `(place.width / natural.width, place.height /
natural.height)` instead of one factor, so background, outline and shadow stretch with the
  letters, as an After Effects text layer does. `TextEditor.tsx` uses `scale(k·scale·scaleX,
k·scale·scaleY)`. Text does not `except` the new fields.
- **The type.** The four fields are required in `ClipTransform`, with defaults in
  `IDENTITY_TRANSFORM`; `clipTransform()` already fills missing fields from it, so stored
  transforms stay partial. Literals that build a full `ClipTransform` (tests, presets, gestures)
  gain the fields by spreading `IDENTITY_TRANSFORM`. The group's `defaults()` already spreads it.
- **Motion path traces the pivot.** `x`/`y` are the pivot's position, so the keyframe motion path
  (`keyframe/logic/motion.ts`) draws where the pivot travels, as After Effects draws the anchor's
  path. No change there. Presets, sticker add and composition placement write `x`/`y` with the
  pivot at its default (center), so they keep meaning the picture's center.
- **Frame resize keeps the picture where it was.** `composition/logic/resize.ts` does change: the
  picture's center is scaled as today (`× kx`, `× ky`), then `x`/`y` are recomputed from that
  center and the new placement's pivot offset, so an off-center pivot doesn't drift when the aspect
  changes. Same for the keys of `transform.x`/`transform.y` (at each key, with the clip's static
  other fields). With the pivot at 0 it is today's math. The existing resize test gains a pivot case.
- **Zero Width/Height.** 0 may be stored and typed; the picture draws nothing, can't be picked by
  a click, and the box collapses onto the pivot (still selected; its handles sit on the pivot until
  the value leaves 0, e.g. from the panel or the flip buttons). Panel sliders: `ui` range −4…4.
- **Flip with nothing stored.** `transform.flip` reads the effective value (`clipTransform`), so a
  clip without `scaleX` becomes −1. Keys of the axis are negated in the same `ctx.mutate`, one undo
  step. Only clips on video tracks (`transform.not_picture` otherwise); the menu already shows only
  for them. The `choices` command control is confirmed in the plan.
- **Side handle math.** In the picture's own axes from the pivot: new factor = start factor ×
  (signed distance of the pointer now / signed distance at the start). Dragging away grows it,
  toward the pivot shrinks it, and crossing the pivot flips its sign, whatever the current flip.
  The box doesn't mirror, so on screen the handle under the pointer is the one that moves.
- **Rotation** keeps the group's `normalize` and the gestures' `normalizeRotation`.

## Left to the builder

- Exact look of the side handles and the crosshair (kit tokens, sharp shapes; rule 34/35).
- Whether the side handles hide below a minimum on-screen box size.
- Icons for the flip buttons and menu items (`lucide-react`: `FlipHorizontal2`, `FlipVertical2`).
