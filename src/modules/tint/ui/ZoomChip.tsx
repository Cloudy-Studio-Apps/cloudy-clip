import { useEffect, useRef } from "react";
import { useOpenFormat } from "@/modules/project";

/**
 * How big the picture is drawn: its width on screen in CSS pixels over the project's width, so
 * 100% is one picture pixel per CSS pixel (the screen's pixel ratio isn't counted, as in the
 * editor's own zoom). The viewer's stage always fits the picture, so this is measured off the
 * canvas of the frame marked `data-viewer-frame`; a ResizeObserver writes the text, and only when
 * the rounded percent changes.
 */
export function ZoomChip() {
  const chip = useRef<HTMLSpanElement>(null);
  const { width } = useOpenFormat();
  useEffect(() => {
    const canvas = document.querySelector("[data-viewer-frame] canvas");
    if (!canvas) return;
    let last = "";
    const observer = new ResizeObserver(() => {
      const text = `${Math.round((canvas.getBoundingClientRect().width / width) * 100)}%`;
      if (chip.current && text !== last) chip.current.textContent = last = text;
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [width]);
  return (
    <span
      ref={chip}
      title="How big the picture is drawn, fitted to the viewer"
      className="ml-1 rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground"
    />
  );
}
