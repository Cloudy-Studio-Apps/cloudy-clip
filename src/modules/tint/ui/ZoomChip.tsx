import { useEffect, useRef } from "react";

/** Marks the viewer's frame so the zoom chip can find the picture. */
export const VIEWER_FRAME_ATTR = "data-viewer-frame";

/**
 * How big the picture is drawn, as a share of its own pixels. The viewer's stage always fits the
 * picture (the preview's zoom doesn't apply to it), so this is measured off the canvas; the text
 * is written to the DOM only when the rounded percent changes.
 */
export function ZoomChip() {
  const chip = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    let last = "";
    const follow = () => {
      const canvas = document.querySelector<HTMLCanvasElement>(`[${VIEWER_FRAME_ATTR}] canvas`);
      if (canvas && chip.current && canvas.width > 0) {
        const text = `${Math.round((canvas.getBoundingClientRect().width / canvas.width) * 100)}%`;
        if (text !== last) chip.current.textContent = last = text;
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <span
      ref={chip}
      title="How big the picture is drawn, fitted to the viewer"
      className="ml-1 rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground"
    />
  );
}
