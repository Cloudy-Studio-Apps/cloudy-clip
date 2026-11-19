import { setProps } from "@/modules/element";
import { clipPlacement } from "@/modules/project";
import { TRANSFORM_KEYS, transformPatch, unshift } from "../logic/commit";
import { toFramePoint } from "../logic/frame";
import {
  moveTransform,
  pivotTransform,
  rotateTransform,
  ROTATION_STEP,
  scaleTransform,
  stretchTransform,
} from "../logic/gestures";
import type { ClipTransform } from "@/modules/project";
import type { TransformGestureOptions } from "../transform.types";
import { applyBox, pivotStyle } from "./box.style";

/** Snap distance to the frame's center lines, in screen pixels. */
const SNAP_SCREEN_PX = 8;
const CURSORS: Record<TransformGestureOptions["mode"], string> = {
  move: "move",
  scale: "nwse-resize",
  rotate: "grabbing",
  stretchX: "ew-resize",
  stretchY: "ns-resize",
  pivot: "crosshair",
};

/**
 * Drags a clip's picture on the canvas. While dragging, the preview draws the live transform and
 * the box follows (no React renders, nothing in the project changes). Only the fields the element
 * supports change. Release commits one `element.setProps` with the changed fields (a `transform`
 * patch), so the gesture is a single undo step.
 */
export function startTransformGesture(options: TransformGestureOptions): void {
  const {
    mode,
    clipId,
    start,
    source,
    fit,
    fields,
    shift,
    format,
    frame,
    box,
    guides,
    down,
    preview,
    bus,
  } = options;
  // Fields the element doesn't support stay where they started.
  const supported = (next: ClipTransform): ClipTransform => ({
    ...next,
    ...Object.fromEntries(TRANSFORM_KEYS.filter((k) => !fields.has(k)).map((k) => [k, start[k]])),
  });
  const at = (e: PointerEvent) => toFramePoint(frame, format, e.clientX, e.clientY);
  const from = at(down);
  const startPlacement = clipPlacement(format, source, start, fit);
  // Scale, stretch and rotation turn about the pivot, which sits at x/y.
  const pivot = { x: format.width / 2 + start.x, y: format.height / 2 + start.y };
  const crosshair = box?.querySelector<HTMLElement>('[data-handle="pivot"]') ?? null;
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
      current = scaleTransform(start, pivot, from, to);
    } else if (mode === "stretchX" || mode === "stretchY") {
      current = stretchTransform(start, pivot, mode === "stretchX" ? "x" : "y", from, to);
    } else if (mode === "pivot") {
      current = pivotTransform(start, startPlacement, { x: to.x - from.x, y: to.y - from.y });
    } else {
      current = rotateTransform(start, pivot, from, to, e.shiftKey ? ROTATION_STEP : 0);
    }
    current = supported(current);
    preview.previewTransform(clipId, current);
    if (box) applyBox(box, clipPlacement(format, source, current, fit), format);
    if (crosshair) Object.assign(crosshair.style, pivotStyle(current));
  };

  const finish = async () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    document.body.style.cursor = "";
    showGuides(false, false);
    const patch = transformPatch(unshift(start, shift), unshift(current, shift), fields);
    const result = patch
      ? await bus.run(setProps, {
          clipIds: [clipId],
          patch: { transform: patch },
          at: preview.playback.getTime(),
        })
      : null;
    preview.previewTransform(clipId, null);
    // On failure (or no change) React won't re-render the box: put it back where it was.
    if (box && !result?.ok) applyBox(box, startPlacement, format);
    if (crosshair && !result?.ok) Object.assign(crosshair.style, pivotStyle(start));
  };

  document.body.style.cursor = CURSORS[mode];
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
}
