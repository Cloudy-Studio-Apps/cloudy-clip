import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { projectStore } from "@/modules/project";
import { attachPreviewCanvas, redrawPreview } from "../preview.controller";
import { Transport } from "./Transport";

/**
 * The preview panel. The canvas keeps the project's aspect ratio and its backing store matches
 * the displayed size × device pixel ratio (capped at the project resolution), so it is sharp
 * without wasting fill rate.
 */
export function PreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const format = useStore(projectStore.api, (s) => s.format);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return attachPreviewCanvas(canvas);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const fit = () => {
      const { clientWidth, clientHeight } = container;
      const scale = Math.min(clientWidth / format.width, clientHeight / format.height);
      const cssWidth = Math.max(1, Math.floor(format.width * scale));
      const cssHeight = Math.max(1, Math.floor(format.height * scale));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      const ratio = Math.min(window.devicePixelRatio || 1, format.width / cssWidth);
      canvas.width = Math.round(cssWidth * Math.max(ratio, 1));
      canvas.height = Math.round(cssHeight * Math.max(ratio, 1));
      redrawPreview();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [format]);

  return (
    <section className="flex h-full flex-col">
      <div ref={containerRef} className="flex min-h-0 flex-1 items-center justify-center p-3">
        <canvas ref={canvasRef} className="bg-black shadow-lg" />
      </div>
      <Transport />
    </section>
  );
}
