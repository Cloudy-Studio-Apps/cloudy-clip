# transform

Placing pictures (video and text) in the frame, like CapCut on the surface and After Effects
underneath: click a picture in the preview to select its clip, drag it to move (snapping to the
frame's center lines), drag a corner to scale, a side to stretch that axis (dragging past the pivot
flips it), the handle on top to rotate (Shift snaps to 15°), and Alt+drag the crosshair to move the pivot
(the picture stays put: `x`/`y` follow the pivot; a plain drag on it moves the picture). Moving snaps
the pivot to the center lines, as After Effects snaps the anchor. Scale, stretch and rotation turn about the
pivot. Click empty space to deselect.

- **Tier:** feature
- **Requires:** `project`, `element` (picture sizes and fits), `media` (picture sizes), `fonts` (re-measure text when a font loads), `preview`, `timeline` (the selection)
- **Contributes:** Flip horizontally, Flip vertically and Reset transform in a clip's menu (`transform.menu.ts`, video tracks only); shared groups `transform` and `composite` (`sharedGroups`, their sections in every element's panel
  on video tracks); preview overlay `transform.overlay`
- **Points it owns:** —
- **API:** `hideBox(owner, hidden)` and `boxHidden` (a store of `{ owners }`): the overlay draws nothing while any owner hides the box, so another canvas tool (the `mask` module) can take over the canvas. Also exports `useVisibleLayers()` (right from its first render, so a tool mounted on demand sees the layers at once) and `VisibleLayer`.
- **Files:**
  - `transform.group.ts`: `transformGroup`, the shared group `transform` stored at
    `Clip.transform`, the After Effects model: `x`, `y` (where the pivot sits, output px from the
    frame center, ±100000), `scale` (0.01–20, shown as %), `scaleX`, `scaleY` (Width and Height
    on top of `scale`, −20…20, shown as %; negative is flipped on that axis), `rotation` (degrees,
    brought into (-180, 180] by `normalize`), `pivotX`, `pivotY` (the pivot in the picture, a
    fraction of its size from its center, ±10, shown as %: −50% is the left or top edge). Scale,
    stretch and rotation happen about the pivot; with the pivot at its default, `x`/`y` are the
    picture's center. Typing a pivot value moves the picture (as After Effects' Anchor Point
    field); only the canvas crosshair keeps it still. Missing means fitted and centered
    (`IDENTITY_TRANSFORM`); `element.setProps` removes it when the values are back to that.
    Applies only on video tracks (a patch for a clip on an audio track fails with
    `element.invalid_props`). Its section, in the Video tab: Position (X, Y), Scale, Stretch
    (Width, Height), Rotation, Pivot (X, Y), and Flip (Horizontal, Vertical: `transform.flip`
    through the `choices` control); the band's reset does what `transform.reset` does.
  - `transform.composite.group.ts`: `compositeGroup`, the shared group `composite` stored at `Clip.composite`: `mode` (one of `BLEND_MODES`) and `opacity` (0–1, shown as %). Missing means Normal at 100%, and `element.setProps` removes it when the values are back to that. An element opts in with `composite: true` in `supports`; all five picture elements do. Applies only on video tracks. Its section, in the Video tab, sits right under Transform (order 910). The engine draws it.
  - `transform.commands.ts`: `transform.reset` (`clipIds`): drops `Clip.transform` and the key tracks under `transform.`, one undo step. `transform.flip` (`clipIds`, `axis`: `horizontal` | `vertical`): negates `scaleX` or `scaleY` (the effective value, so a clip with none stored becomes −1) and every key of `transform.scaleX` / `transform.scaleY`, so the whole clip mirrors, one undo step; `transform.clip_not_found`, `transform.not_picture` (not on a video track).
  - `logic/`: pure parts: `picking.ts` (hit test of rotated pictures; one squashed to zero width or height isn't hit), `gestures.ts`
    (move/scale/rotate math about the pivot, snapping; `stretchTransform`: one axis, in the
    picture's own axes from the pivot, sign flips past it; `pivotTransform`: moves the pivot and
    `x`/`y` together so the picture stays), `layers.ts` (which pictures are on screen: media sized from probes, other elements from their `picture.size` with the live override; each layer's `transform` is
    the live `transform` patch over the saved one, so a panel slider moves the box too; elements
    without the `transform` group are left out, so they can't be picked or dragged, and each layer
    lists the transform `fields` its element supports), `commit.ts` (`TRANSFORM_KEYS`; `transformPatch`: only the
    changed, supported fields, or null), `frame.ts`
    (screen → frame coordinates). Placement is `project`'s `clipPlacement`, so the box and the
    picture always agree.
  - `ui/`: `TransformOverlay` (its root takes the pointer: `pointer-events-auto`, since the overlay wrappers ignore it), `SelectionBox`, `transform.gesture.ts` (while dragging, the preview
    draws the live value through `PreviewApi.previewTransform` and the box follows through direct
    DOM updates; release commits one `element.setProps` with a `transform` patch of the changed, supported (and `at`, the playhead, so an animated field gets a key there)
    fields, one undo step; nothing when none changed), `layers.hook.ts`. The box shows
    when the selection is one clip or one linked picture + sound (`selectionSubject`). An element
    that `except`s fields: the box hides the corners without `scale`, the side handles without `scaleX` / `scaleY`, the
    crosshair without both `pivotX` and `pivotY`, and the rotate handle without
    `rotation`, and a picture without `x` and `y` is selected by a click but not dragged.
- **Keys and paths:** `visibleLayers` reads each clip through `followedClip(clip, time, paths, live)` (`project`), so the box sits on the picture the engine draws, on a follower's motion path too; the live patch goes in as its live values. A follower's layer carries `shift` (what its path adds now), and a gesture takes it off before committing (`unshift`, `logic/commit.ts`), since a follower stores its offset from the path: dragging, rotating or moving the pivot of a follower edits its offset and it doesn't jump on release.
- **Mattes:** `visibleLayers` keeps clips on a matte track (`matteTracks`, `project`) but marks them `matte: true`; a canvas click skips them, while a selected matte clip still gets its box.
- **Not yet:** crop, a switch on the Composite band, keeping an off-center pivot in place when a composition is resized with `scale` and its aspect changes (`composition/logic/resize.ts`).

| Command                                 | MCP tool                                 |
| --------------------------------------- | ---------------------------------------- |
| `transform.reset`                       | `transform_reset`                        |
| `transform.flip`                        | `transform_flip`                         |
| `element.setProps` with `{ transform }` | `element_set_props` (owned by `element`) |
