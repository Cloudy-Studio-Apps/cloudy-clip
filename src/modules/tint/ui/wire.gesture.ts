import { wirePath } from "../logic/wires";
import { startGraphDrag } from "./node.drag.gesture";
import type { WireDragOptions } from "./ui.types";

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
