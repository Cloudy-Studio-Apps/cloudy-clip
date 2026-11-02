# transform

Placing pictures (video and text) in the frame, like CapCut: click a picture in the preview to
select its clip, drag
it to move (snapping to the frame's center lines), drag a corner to scale, drag the handle on top to
rotate (Shift snaps to 15°). Click empty space to deselect.

- **Tier:** feature
- **Requires:** `project`, `element` (picture sizes and fits), `media` (picture sizes), `fonts` (re-measure text when a font loads), `preview`, `timeline` (the selection)
- **Contributes:** Reset transform in a clip's menu (`transform.menu.ts`); shared groups `transform` and `composite` (`sharedGroups`, their sections in every element's panel
  on video tracks); preview overlay `transform.overlay`
- **Points it owns:** —
- **API:** none beyond its exported command and group (`TransformApi` is empty)
- **Files:**
  - `transform.group.ts`: `transformGroup`, the shared group `transform` stored at
    `Clip.transform`: `x`, `y` (output px from the frame center, ±100000), `scale` (0.01–20,
    shown as %), `rotation` (degrees, brought into (-180, 180] by `normalize`). Missing means
    fitted and centered (`IDENTITY_TRANSFORM`); `element.setProps` removes it when the values are
    back to that. Applies only on video tracks (a patch for a clip on an audio track fails with
    `element.invalid_props`). Its section, in the Video tab: a Position row (X, Y), scale, rotation; the band's reset does what
    `transform.reset` does.
  - `transform.composite.group.ts`: `compositeGroup`, the shared group `composite` stored at `Clip.composite`: `mode` (one of `BLEND_MODES`) and `opacity` (0–1, shown as %). Missing means Normal at 100%, and `element.setProps` removes it when the values are back to that. An element opts in with `composite: true` in `supports`; all five picture elements do. Applies only on video tracks. Its section, in the Video tab, sits right under Transform (order 910). The engine draws it.
  - `transform.commands.ts`: `transform.reset` (`clipIds`): drops `Clip.transform` and the key tracks under `transform.`, one undo step.
  - `logic/`: pure parts: `picking.ts` (hit test of rotated pictures), `gestures.ts`
    (move/scale/rotate math, snapping), `layers.ts` (which pictures are on screen: media sized from probes, other elements from their `picture.size` with the live override; each layer's `transform` is
    the live `transform` patch over the saved one, so a panel slider moves the box too; elements
    without the `transform` group are left out, so they can't be picked or dragged, and each layer
    lists the transform `fields` its element supports), `commit.ts` (`transformPatch`: only the
    changed, supported fields, or null), `frame.ts`
    (screen → frame coordinates). Placement is `project`'s `clipPlacement`, so the box and the
    picture always agree.
  - `ui/`: `TransformOverlay` (its root takes the pointer: `pointer-events-auto`, since the overlay wrappers ignore it), `SelectionBox`, `transform.gesture.ts` (while dragging, the preview
    draws the live value through `PreviewApi.previewTransform` and the box follows through direct
    DOM updates; release commits one `element.setProps` with a `transform` patch of the changed, supported (and `at`, the playhead, so an animated field gets a key there)
    fields, one undo step; nothing when none changed), `layers.hook.ts`. The box shows
    when the selection is one clip or one linked picture + sound (`selectionSubject`). An element
    that `except`s fields: the box hides the corners without `scale` and the rotate handle without
    `rotation`, and a picture without `x` and `y` is selected by a click but not dragged.
- **Keys:** `visibleLayers` reads each clip through `animatedClip(clip, time)`, so the box sits on the picture the engine draws; the live `transform` patch still goes over it.
- **Not yet:** keyframes editing, crop, flip, a switch on the Composite band.

| Command                                 | MCP tool                                 |
| --------------------------------------- | ---------------------------------------- |
| `transform.reset`                       | `transform_reset`                        |
| `element.setProps` with `{ transform }` | `element_set_props` (owned by `element`) |
