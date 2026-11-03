import { useEffect, useRef, type RefObject } from "react";
import type { GraphView } from "../tint.types";
import { createGraphCamera } from "./graph.camera";
import type { GraphCamera } from "./ui.types";

/** A camera on the node graph's elements, for as long as they're mounted. */
export function useGraphCamera(
  wrap: RefObject<HTMLDivElement | null>,
  svg: RefObject<SVGSVGElement | null>,
  home: GraphView,
): RefObject<GraphCamera | null> {
  const camera = useRef<GraphCamera | null>(null);
  useEffect(() => {
    const box = wrap.current;
    const el = svg.current;
    if (!box || !el) return;
    const next = createGraphCamera(box, el, home);
    camera.current = next;
    return () => {
      next.dispose();
      camera.current = null;
    };
  }, [wrap, svg, home]);
  return camera;
}
