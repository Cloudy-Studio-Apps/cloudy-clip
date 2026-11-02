import type { LibraryItem, MediaDragDetail } from "./media.types";

/** Fired on `window` while media is dragged. */
export const MEDIA_DRAG_MOVE = "cloudy:media-drag-move";
/** Fired on `window` when a media drag ends (dropped or cancelled). */
export const MEDIA_DRAG_END = "cloudy:media-drag-end";
/** Fired (bubbling) on the element under the pointer when media is dropped. */
export const MEDIA_DROP = "cloudy:media-drop";

/** Pixels the pointer must move before a press becomes a drag (so clicks still work). */
const DRAG_THRESHOLD = 4;

/**
 * Starts tracking a possible drag of a library item. Uses plain DOM for the ghost so dragging
 * never re-renders React. Drop targets listen for {@link MEDIA_DROP}.
 */
export function startMediaDrag(item: LibraryItem, label: string, down: PointerEvent): void {
  const originX = down.clientX;
  const originY = down.clientY;
  let ghost: HTMLDivElement | null = null;

  const detail = (e: PointerEvent): MediaDragDetail => ({
    item,
    clientX: e.clientX,
    clientY: e.clientY,
  });

  function onMove(e: PointerEvent): void {
    if (!ghost) {
      if (Math.hypot(e.clientX - originX, e.clientY - originY) < DRAG_THRESHOLD) return;
      ghost = document.createElement("div");
      ghost.textContent = label;
      ghost.className =
        "pointer-events-none fixed left-0 top-0 z-50 max-w-48 truncate rounded-[3px] bg-primary px-2 py-1 text-sm font-bold text-primary-foreground shadow-popover";
      document.body.appendChild(ghost);
      document.body.style.cursor = "grabbing";
    }
    ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`;
    window.dispatchEvent(new CustomEvent<MediaDragDetail>(MEDIA_DRAG_MOVE, { detail: detail(e) }));
  }

  function finish(e: PointerEvent, dropped: boolean): void {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    if (!ghost) return;
    ghost.remove();
    document.body.style.cursor = "";
    if (dropped) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      target?.dispatchEvent(
        new CustomEvent<MediaDragDetail>(MEDIA_DROP, { bubbles: true, detail: detail(e) }),
      );
    }
    window.dispatchEvent(new CustomEvent<MediaDragDetail>(MEDIA_DRAG_END, { detail: detail(e) }));
  }

  const onUp = (e: PointerEvent) => finish(e, true);
  const onCancel = (e: PointerEvent) => finish(e, false);

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}
