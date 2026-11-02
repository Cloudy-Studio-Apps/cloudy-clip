import type { BoxSelectOptions } from "../keyframe.types";

/** Draws a rubber band over the panel while the pointer drags, and hands the box over on release. */
export function startBoxSelect({ event, root, onDone }: BoxSelectOptions): void {
  const origin = root.getBoundingClientRect();
  const x0 = event.clientX;
  const y0 = event.clientY;
  const band = document.createElement("div");
  band.className = "pointer-events-none absolute z-30 border border-primary bg-primary-soft/40";
  band.style.display = "none";
  root.append(band);

  const boxAt = (e: PointerEvent) => ({
    left: Math.min(x0, e.clientX),
    top: Math.min(y0, e.clientY),
    right: Math.max(x0, e.clientX),
    bottom: Math.max(y0, e.clientY),
  });
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    band.remove();
  };
  function move(e: PointerEvent) {
    const b = boxAt(e);
    band.style.cssText = `left:${b.left - origin.left}px;top:${b.top - origin.top}px;width:${b.right - b.left}px;height:${b.bottom - b.top}px`;
  }
  function up(e: PointerEvent) {
    stop();
    onDone(boxAt(e));
  }
  function cancel() {
    stop();
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
}
