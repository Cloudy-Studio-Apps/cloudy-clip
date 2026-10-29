import type { Cut } from "@/modules/junction";
import type { PresetGestureHandlers } from "../transition.types";

/** Pixels the pointer must move before a press becomes a drag (so clicks still work). */
const DRAG_THRESHOLD = 4;

/**
 * Tracks a press on a preset tile: a click calls `onClick`; a drag shows a ghost labelled `label`
 * under the pointer (plain DOM, no React renders), highlights the cut under it and, released over
 * a cut, calls `onDrop`. Released anywhere else does nothing.
 */
export function startPresetDrag(
  down: PointerEvent,
  label: string,
  handlers: PresetGestureHandlers,
): void {
  let ghost: HTMLDivElement | null = null;
  let hovered: Cut | null = null;

  function setHovered(cut: Cut | null): void {
    const same = hovered?.left.id === cut?.left.id && hovered?.right.id === cut?.right.id;
    if (same) return;
    hovered = cut;
    handlers.onHover(cut);
  }

  function onMove(e: PointerEvent): void {
    if (!ghost) {
      if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < DRAG_THRESHOLD) return;
      ghost = document.createElement("div");
      ghost.textContent = label;
      ghost.className =
        "pointer-events-none fixed left-0 top-0 z-50 rounded-sm bg-primary px-2 py-1 text-sm font-bold text-primary-foreground shadow-popover";
      document.body.appendChild(ghost);
      document.body.style.cursor = "grabbing";
    }
    ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`;
    setHovered(handlers.cutAt(e.clientX, e.clientY));
  }

  function finish(e: PointerEvent, released: boolean): void {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    if (!ghost) {
      if (released) handlers.onClick();
      return;
    }
    ghost.remove();
    document.body.style.cursor = "";
    const target = released ? handlers.cutAt(e.clientX, e.clientY) : null;
    setHovered(null);
    if (target) handlers.onDrop(target);
  }

  const onUp = (e: PointerEvent) => finish(e, true);
  const onCancel = (e: PointerEvent) => finish(e, false);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}
