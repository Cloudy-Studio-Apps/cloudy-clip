import { framePoint } from "@/modules/path";
import { dragPatch } from "../logic/handles";
import { toMask } from "../logic/mapping";
import type { MaskDragOptions, MaskPatch } from "../mask.types";

/** How far the pointer goes before a press is a drag, in px. */
const DRAG_THRESHOLD = 3;

/**
 * Drags a handle of the selected mask (or the mask itself): the pointer is mapped into mask space,
 * so the handle stays under it however the clip is scaled, turned or flipped. Each move hands the
 * patch to `onMove` (the caller repaints the DOM and the engine); release hands it to `onDrop`,
 * which sends one `mask.update`. A press that barely moves does nothing. Escape cancels.
 */
export function startMaskDrag({
  event,
  frame,
  format,
  mapping,
  mask,
  handle,
  onMove,
  onDrop,
  onCancel,
}: MaskDragOptions): void {
  const at = (e: PointerEvent) => toMask(mapping, framePoint(frame, format, e.clientX, e.clientY));
  const from = at(event);
  let patch: MaskPatch | null = null;

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  function move(e: PointerEvent) {
    const far = Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY);
    if (!patch && far < DRAG_THRESHOLD) return;
    patch = dragPatch(mask, handle, from, at(e), { shift: e.shiftKey, alt: e.altKey });
    onMove(patch);
  }
  function up() {
    stop();
    if (patch) onDrop(patch);
  }
  function cancel() {
    stop();
    if (patch) onCancel();
  }
  function key(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    cancel();
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
}
