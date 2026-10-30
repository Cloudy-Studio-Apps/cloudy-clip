import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

interface GridWindow {
  ref: RefObject<HTMLDivElement | null>;
  /** Rows to draw: `first` included, `last` not. */
  first: number;
  last: number;
  rowHeight: number;
}

/**
 * Which rows of a scrolling grid of square tiles are in view, plus one above and below. Scrolling
 * is measured without React, and only a new range renders.
 */
export function useGridWindow(rows: number, columns: number, gap: number): GridWindow {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ first: 0, last: 0, rowHeight: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const rowHeight = (element.clientWidth - gap * (columns - 1)) / columns + gap;
      const { scrollTop, clientHeight } = element;
      const first = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
      const last = Math.min(rows, Math.ceil((scrollTop + clientHeight) / rowHeight) + 1);
      setRange((old) =>
        old.first === first && old.last === last && old.rowHeight === rowHeight
          ? old
          : { first, last, rowHeight },
      );
    };
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [rows, columns, gap]);

  return { ref, ...range };
}
