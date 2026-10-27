/** Pixels the pointer must move before a press becomes a drag (so clicks still work). */
const DRAG_THRESHOLD = 4;

/**
 * Tracks a press on a text tile: a click calls `onClick`, a drag shows a ghost under the pointer
 * (plain DOM, no React renders) and calls `onDrop` with where it was released.
 */
export function startTextDrag(
  down: PointerEvent,
  handlers: { onClick(): void; onDrop(clientX: number, clientY: number): void },
): void {
  let ghost: HTMLDivElement | null = null;

  function onMove(e: PointerEvent): void {
    if (!ghost) {
      if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < DRAG_THRESHOLD) return;
      ghost = document.createElement("div");
      ghost.textContent = "Text";
      ghost.className =
        "pointer-events-none fixed left-0 top-0 z-50 rounded-sm bg-clip-type px-2 py-1 text-sm font-bold text-white shadow-popover";
      document.body.appendChild(ghost);
      document.body.style.cursor = "grabbing";
    }
    ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`;
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
    if (released) handlers.onDrop(e.clientX, e.clientY);
  }

  const onUp = (e: PointerEvent) => finish(e, true);
  const onCancel = (e: PointerEvent) => finish(e, false);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}
