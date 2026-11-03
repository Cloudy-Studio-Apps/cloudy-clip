import { panView, unitsPerPx, zoomView } from "../logic/viewbox";
import type { GraphView } from "../tint.types";
import type { GraphCamera } from "./ui.types";

/** Size of the dot grid behind the graph, in graph units. */
const DOT = 22;

/** Wheel zoom speed: the view widens by e^(deltaY × this). */
const WHEEL_ZOOM_SPEED = 0.0015;

/**
 * Pans and zooms the node graph on its own elements: drag empty space or middle-drag to move,
 * wheel to scroll (Shift sideways), Ctrl/Cmd + wheel to zoom at the pointer, double-click empty
 * space to fit. Writes the SVG's view box and the dot grid straight to the DOM, so nothing
 * re-renders while moving (rule 24).
 */
export function createGraphCamera(
  box: HTMLDivElement,
  svg: SVGSVGElement,
  home: GraphView,
): GraphCamera {
  let view = home;

  const apply = () => {
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
    // The dots follow the graph: its spacing and offset in screen pixels.
    const scale = unitsPerPx(view, box.clientWidth, box.clientHeight);
    const left = (box.clientWidth - view.width / scale) / 2 - view.x / scale;
    const top = (box.clientHeight - view.height / scale) / 2 - view.y / scale;
    box.style.backgroundSize = `${DOT / scale}px ${DOT / scale}px`;
    box.style.backgroundPosition = `${left}px ${top}px`;
  };

  const fit = () => {
    view = home;
    apply();
  };

  const toGraph = (clientX: number, clientY: number): [number, number] => {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const at = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return [at.x, at.y];
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(event.deltaY * WHEEL_ZOOM_SPEED);
      view = zoomView(view, factor, toGraph(event.clientX, event.clientY));
    } else {
      const scale = unitsPerPx(view, box.clientWidth, box.clientHeight);
      const dx = event.shiftKey ? event.deltaY : event.deltaX;
      const dy = event.shiftKey ? 0 : event.deltaY;
      view = panView(view, -dx, -dy, scale);
    }
    apply();
  };

  const onPointerDown = (event: PointerEvent) => {
    const onNode = (event.target as Element).closest("[data-node]");
    if (event.button !== 1 && (event.button !== 0 || onNode)) return;
    event.preventDefault();
    const start = view;
    const scale = unitsPerPx(start, box.clientWidth, box.clientHeight);
    const x0 = event.clientX;
    const y0 = event.clientY;
    box.setPointerCapture(event.pointerId);
    box.style.cursor = "grabbing";
    const move = (e: PointerEvent) => {
      view = panView(start, e.clientX - x0, e.clientY - y0, scale);
      apply();
    };
    const up = () => {
      box.style.cursor = "";
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", up);
      box.removeEventListener("pointercancel", up);
    };
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
  };

  const onDoubleClick = (event: MouseEvent) => {
    if (!(event.target as Element).closest("[data-node]")) fit();
  };

  const observer = new ResizeObserver(apply);
  observer.observe(box);
  box.addEventListener("wheel", onWheel, { passive: false });
  box.addEventListener("pointerdown", onPointerDown);
  box.addEventListener("dblclick", onDoubleClick);
  apply();

  return {
    fit,
    dispose() {
      observer.disconnect();
      box.removeEventListener("wheel", onWheel);
      box.removeEventListener("pointerdown", onPointerDown);
      box.removeEventListener("dblclick", onDoubleClick);
    },
  };
}
