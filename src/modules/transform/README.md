# transform

Placing pictures in the frame, like CapCut: click a picture in the preview to select its clip, drag
it to move (snapping to the frame's center lines), drag a corner to scale, drag the handle on top to
rotate (Shift snaps to 15°). Click empty space to deselect.

- **Tier:** feature
- **Requires:** `project`, `media` (picture sizes), `preview`, `timeline` (the selection)
- **Contributes:** preview overlay `transform.overlay`
- **Points it owns:** —
- **API:** none beyond its exported command (`TransformApi` is empty)
- **Files:**
  - `transform.commands.ts`: `transform.setClipTransform`, a partial `x`, `y`, `scale`, `rotation`
    or `reset`, video clips only. The data is `Clip.transform` in `project`, where the preview engine
    reads it.
  - `logic/`: pure, tested parts: `picking.ts` (hit test of rotated pictures), `gestures.ts`
    (move/scale/rotate math, snapping), `layers.ts` (which pictures are on screen), `frame.ts`
    (screen → frame coordinates). Placement is `project`'s `clipPlacement`, so the box and the
    picture always agree.
  - `ui/`: `TransformOverlay`, `SelectionBox`, `transform.gesture.ts` (while dragging, the preview
    draws the live value through `PreviewApi.previewTransform` and the box follows through direct
    DOM updates; release commits one command, so one undo step), `layers.hook.ts`.
- **Not yet:** keyframes, crop, flip, opacity, numeric fields.

| Command                      | MCP tool                       |
| ---------------------------- | ------------------------------ |
| `transform.setClipTransform` | `transform_set_clip_transform` |
