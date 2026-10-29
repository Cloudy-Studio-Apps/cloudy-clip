# transform

Placing pictures (video and text) in the frame, like CapCut: click a picture in the preview to
select its clip, drag
it to move (snapping to the frame's center lines), drag a corner to scale, drag the handle on top to
rotate (Shift snaps to 15°). Click empty space to deselect.

- **Tier:** feature
- **Requires:** `project`, `element` (picture sizes and fits), `media` (picture sizes), `fonts` (re-measure text when a font loads), `preview`, `timeline` (the selection)
- **Contributes:** shared group `transform` (`sharedGroups`, its section in every element's panel
  on video tracks); preview overlay `transform.overlay`
- **Points it owns:** —
- **API:** none beyond its exported command and group (`TransformApi` is empty)
- **Files:**
  - `transform.group.ts`: `transformGroup`, the shared group `transform` stored at
    `Clip.transform`: `x`, `y` (output px from the frame center, ±100000), `scale` (0.01–20,
    shown as %), `rotation` (degrees, brought into (-180, 180] by `normalize`). Missing means
    fitted and centered (`IDENTITY_TRANSFORM`); `element.setProps` removes it when the values are
    back to that. Applies only on video tracks (a patch for a clip on an audio track fails with
    `element.invalid_props`). Its section: X/Y row, scale, rotation, Reset (`transform.reset`).
  - `transform.commands.ts`: `transform.reset` (`clipIds`): drops `Clip.transform`, one undo step.
  - `logic/`: pure, tested parts: `picking.ts` (hit test of rotated pictures), `gestures.ts`
    (move/scale/rotate math, snapping), `layers.ts` (which pictures are on screen: media sized from probes, other elements from their `picture.size` with the live override), `frame.ts`
    (screen → frame coordinates). Placement is `project`'s `clipPlacement`, so the box and the
    picture always agree.
  - `ui/`: `TransformOverlay` (its root takes the pointer: `pointer-events-auto`, since the overlay wrappers ignore it), `SelectionBox`, `transform.gesture.ts` (while dragging, the preview
    draws the live value through `PreviewApi.previewTransform` and the box follows through direct
    DOM updates; release commits one `element.setProps` with a `transform` patch, one undo step), `layers.hook.ts`. The box shows
    when the selection is one clip or one linked picture + sound (`selectionSubject`).
- **Not yet:** keyframes, crop, flip, opacity.

| Command                                 | MCP tool                                 |
| --------------------------------------- | ---------------------------------------- |
| `transform.reset`                       | `transform_reset`                        |
| `element.setProps` with `{ transform }` | `element_set_props` (owned by `element`) |
