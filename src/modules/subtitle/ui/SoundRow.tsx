import { useEffect, useRef } from "react";
import { LOCAL_ACTOR, useModule } from "@/core";
import { mediaRef } from "@/modules/media";
import { projectRef, type MediaId } from "@/modules/project";
import { pxToTime, TIMELINE_SCROLLER, timelineRef } from "@/modules/timeline";
import { soundLine } from "../logic/context";

/**
 * The composition's sound as a line the width of the view, sticking at its left edge (after the
 * headers): redrawn on scroll, zoom, a project change, a resize and when peaks arrive. Peaks are
 * asked for only for the clips in view, each file once.
 */
export function SoundRow({ headerWidth, height }: { headerWidth: number; height: number }) {
  const project = useModule(projectRef);
  const media = useModule(mediaRef);
  const timeline = useModule(timelineRef);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scroller = canvas?.closest<HTMLElement>(TIMELINE_SCROLLER);
    const g = canvas?.getContext("2d");
    if (!canvas || !scroller || !g) return;
    const asked = new Set<MediaId>();
    const peaksOf = (id: MediaId) => {
      const peaks = media.peaksNow(id);
      if (!peaks && !asked.has(id)) {
        asked.add(id);
        void media.peaks(id);
      }
      return peaks;
    };
    let frame = 0;
    const draw = () => {
      frame = 0;
      const width = Math.max(0, Math.floor(scroller.clientWidth - headerWidth));
      const ratio = window.devicePixelRatio || 1;
      canvas.style.width = `${width}px`;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const open = project.view.openFor(LOCAL_ACTOR);
      if (open === null || width === 0) return;
      const pps = timeline.view.getState().pxPerSecond;
      const from = pxToTime(scroller.scrollLeft, pps);
      const to = pxToTime(scroller.scrollLeft + width, pps);
      const line = soundLine(project.store.getState(), open, peaksOf, from, to, width);
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      g.fillStyle = getComputedStyle(canvas).color;
      const middle = height / 2;
      line.forEach((peak, x) => {
        const half = Math.max(0.5, (peak / 255) * middle);
        g.fillRect(x, middle - half, 1, half * 2);
      });
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();
    scroller.addEventListener("scroll", later, { passive: true });
    const resize = new ResizeObserver(later);
    resize.observe(scroller);
    const offs = [
      timeline.view.subscribe(later),
      project.store.subscribe(later),
      project.view.store.subscribe(later),
      media.onPeaks(later),
    ];
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", later);
      resize.disconnect();
      for (const off of offs) off();
    };
  }, [headerWidth, height, media, project, timeline]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none sticky block text-muted-foreground"
      style={{ left: headerWidth, height }}
    />
  );
}
