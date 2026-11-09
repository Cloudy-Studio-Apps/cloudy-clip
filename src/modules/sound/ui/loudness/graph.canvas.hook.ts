import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { GraphColours } from "../../sound.types";

/** The theme's colours for a graph, read from the canvas's tokens. */
function readColours(canvas: HTMLCanvasElement): GraphColours {
  const style = getComputedStyle(canvas);
  return {
    grid: style.getPropertyValue("--border").trim(),
    line: style.getPropertyValue("--foreground").trim(),
    on: style.getPropertyValue("--on").trim(),
  };
}

/**
 * The upkeep every graph of the Loudness tab shares: a canvas kept at its CSS size times the pixel
 * ratio, the theme's colours (read again when `data-theme` on `<html>` changes), and `redraw`,
 * which calls `draw` only when the tab shows (`shown`) and the canvas has a size. The canvas is
 * drawn again after each render, so a graph catches up when its tab is shown. `draw` may change
 * between renders.
 */
export function useGraphCanvas(
  shown: boolean,
  draw: (canvas: HTMLCanvasElement, colours: GraphColours) => void,
): { canvasRef: RefObject<HTMLCanvasElement | null>; redraw: () => void } {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colours = useRef<GraphColours | null>(null);
  const visible = useRef(shown);
  const drawing = useRef(draw);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible.current || canvas.width <= 1) return;
    colours.current ??= readColours(canvas);
    drawing.current(canvas, colours.current);
  }, []);

  useEffect(() => {
    visible.current = shown;
    drawing.current = draw;
    redraw();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      if (canvas.clientWidth === 0) return;
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * scale);
      canvas.height = Math.round(canvas.clientHeight * scale);
      redraw();
    };
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    const theme = new MutationObserver(() => {
      colours.current = null;
      redraw();
    });
    theme.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      theme.disconnect();
    };
  }, [redraw]);

  return { canvasRef, redraw };
}
