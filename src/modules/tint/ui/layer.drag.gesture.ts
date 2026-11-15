import { dropAt } from "../logic/drop";
import type { DropRow } from "../tint.types";
import type { LayerDragOptions } from "./ui.types";

/**
 * Drags a layer row up and down. It writes DOM feedback only (the row follows the pointer, a line
 * marks the place) and sends one drop on release; Escape puts everything back.
 */
export function startLayerDrag({ event, id, list, line, onDrop }: LayerDragOptions): void {
  const rowOf = (): HTMLElement | null =>
    list.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`);
  const row = rowOf();
  if (!row) return;
  const startY = event.clientY;
  let place: ReturnType<typeof dropAt> = null;
  const rows = (): DropRow[] =>
    [...list.querySelectorAll<HTMLElement>("[data-layer-id]")].map((el) => {
      const box = el.getBoundingClientRect();
      return {
        id: el.dataset.layerId ?? "",
        top: box.top,
        bottom: box.bottom,
        nested: el.dataset.nested === "true",
      };
    });
  const clear = () => {
    row.style.transform = "";
    row.style.zIndex = "";
    row.style.opacity = "";
    line.style.display = "none";
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("keydown", key, true);
  };
  const move = (e: PointerEvent) => {
    row.style.transform = `translateY(${e.clientY - startY}px)`;
    row.style.zIndex = "5";
    row.style.opacity = "0.8";
    place = dropAt(rows(), id, e.clientY);
    if (!place) {
      line.style.display = "none";
      return;
    }
    const box = list.getBoundingClientRect();
    line.style.display = "block";
    line.style.top = `${place.lineY - box.top + list.scrollTop - 1}px`;
  };
  const up = () => {
    const drop = place;
    clear();
    if (drop) onDrop(id, drop.to);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    place = null;
    clear();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("keydown", key, true);
}
