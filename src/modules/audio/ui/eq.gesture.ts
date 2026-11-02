import type { EqBand } from "@/modules/project";

/** Follows a point of the graph: every move as a band, the release as one. No React on the way. */
export function startEqDrag(
  down: PointerEvent,
  svg: SVGSVGElement,
  toBand: (x: number, y: number) => EqBand,
  onInput: (band: EqBand) => void,
  onCommit: (band: EqBand) => void,
): void {
  let last = toBand(...position(down, svg));
  const move = (event: PointerEvent) => {
    last = toBand(...position(event, svg));
    onInput(last);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    onCommit(last);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

/** A pointer's place in the graph's own units. */
function position(event: PointerEvent, svg: SVGSVGElement): [number, number] {
  const box = svg.getBoundingClientRect();
  const { width, height } = svg.viewBox.baseVal;
  return [
    ((event.clientX - box.left) / box.width) * width,
    ((event.clientY - box.top) / box.height) * height,
  ];
}
