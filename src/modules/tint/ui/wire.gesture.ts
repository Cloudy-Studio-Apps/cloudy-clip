import { wirePath } from "../logic/wires";
import type { GraphPoint } from "../tint.types";
import { startGraphDrag } from "./node.drag.gesture";
import type { GraphDragOptions } from "./ui.types";

interface WireDragOptions extends Pick<GraphDragOptions, "event" | "svg"> {
  /** The port the wire leaves, in graph units. */
  from: GraphPoint;
  /** The wire being drawn, an SVG path. */
  line: SVGPathElement;
  /** Where it was dropped (graph units), or null when cancelled. */
  onDrop(at: GraphPoint | null): void;
}

/**
 * Drags a wire out of an output port: a path follows the pointer (attributes only) and the drop is
 * reported once. Escape, or a press that never moves, drops nothing.
 */
export function startWireDrag({ event, svg, from, line, onDrop }: WireDragOptions): void {
  const hide = () => line.setAttribute("display", "none");
  startGraphDrag({
    event,
    svg,
    onMove({ at }) {
      line.setAttribute("d", wirePath(from, at));
      line.removeAttribute("display");
    },
    onEnd(end) {
      hide();
      onDrop(end ? end.at : null);
    },
  });
}
