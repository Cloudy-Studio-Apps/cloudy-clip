import { setProps } from "@/modules/element";
import { clipPlacement } from "@/modules/project";
import { toFramePoint } from "../logic/frame";
import { moveTransform, rotateTransform, ROTATION_STEP, scaleTransform } from "../logic/gestures";
import type { TransformGestureOptions } from "../transform.types";
import { applyBox } from "./box.style";

/** Snap distance to the frame's center lines, in screen pixels. */
const SNAP_SCREEN_PX = 8;

/**
 * Drags a clip's picture on the canvas. While dragging, the preview draws the live transform and
 * the box follows (no React renders, nothing in the project changes). Release commits one
 * `element.setProps` (a `transform` patch), so the gesture is a single undo step.
 */
export function startTransformGesture(options: TransformGestureOptions): void {
  const { mode, clipId, start, source, fit, format, frame, box, guides, down, preview, bus } =
    options;
  const at = (e: PointerEvent) => toFramePoint(frame, format, e.clientX, e.clientY);
  const from = at(down);
  const startPlacement = clipPlacement(format, source, start, fit);
  const center = { x: startPlacement.cx, y: startPlacement.cy };
  const snap = (SNAP_SCREEN_PX * format.width) / frame.getBoundingClientRect().width;
  let current = start;

  const showGuides = (x: boolean, y: boolean) => {
    if (guides.vertical) guides.vertical.hidden = !x;
    if (guides.horizontal) guides.horizontal.hidden = !y;
  };

  const onMove = (e: PointerEvent) => {
    const to = at(e);
    if (mode === "move") {
      const moved = moveTransform(start, { x: to.x - from.x, y: to.y - from.y }, snap);
      current = moved.transform;
      showGuides(moved.snappedX, moved.snappedY);
    } else if (mode === "scale") {
      current = scaleTransform(start, center, from, to);
    } else {
      current = rotateTransform(start, center, from, to, e.shiftKey ? ROTATION_STEP : 0);
    }
    preview.previewTransform(clipId, current);
    if (box) applyBox(box, clipPlacement(format, source, current, fit), format);
  };

  const finish = async () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    document.body.style.cursor = "";
    showGuides(false, false);
    const changed =
      current.x !== start.x ||
      current.y !== start.y ||
      current.scale !== start.scale ||
      current.rotation !== start.rotation;
    const result = changed
      ? await bus.run(setProps, { clipIds: [clipId], patch: { transform: { ...current } } })
      : null;
    preview.previewTransform(clipId, null);
    // On failure (or no change) React won't re-render the box: put it back where it was.
    if (box && !result?.ok) applyBox(box, startPlacement, format);
  };

  document.body.style.cursor =
    mode === "move" ? "move" : mode === "scale" ? "nwse-resize" : "grabbing";
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
}
