import { useCallback, useEffect, useRef } from "react";
import type { LoudnessReading } from "@/modules/preview";
import { meterHeight } from "../logic/meter";
import { LOUDNESS_INTERVAL_MS, useLoudnessFeed } from "./loudness.hook";

/** How much history shows: the last 60 s of readings. */
const SAMPLES = 60_000 / LOUDNESS_INTERVAL_MS;

/** Lines across the graph, in LUFS. */
const GRID = [-12, -24, -36, -48];

/** Draws the short-term loudness of the last 60 s, newest at the right, in the theme's tokens. */
function draw(canvas: HTMLCanvasElement, history: readonly number[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const style = getComputedStyle(canvas);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const y = (lufs: number) => height - meterHeight(lufs) * height;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = token("--border");
  ctx.lineWidth = 1;
  for (const lufs of GRID) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y(lufs)) + 0.5);
    ctx.lineTo(width, Math.round(y(lufs)) + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = token("--foreground");
  ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1);
  ctx.beginPath();
  const step = width / (SAMPLES - 1);
  const offset = SAMPLES - history.length;
  let drawing = false;
  history.forEach((lufs, i) => {
    if (lufs === -Infinity) {
      drawing = false;
      return;
    }
    const x = (offset + i) * step;
    if (drawing) ctx.lineTo(x, y(lufs));
    else ctx.moveTo(x, y(lufs));
    drawing = true;
  });
  ctx.stroke();
}

/**
 * The short-term loudness over the last 60 s on a canvas, sampled at 10 Hz while the timeline
 * plays, with lines every 12 LU. Starts empty when mounted; remount it to clear.
 */
export function LoudnessHistory() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<number[]>([]);

  const onReading = useCallback((reading: LoudnessReading | null, playing: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (playing) {
      history.current.push(reading?.shortTerm ?? -Infinity);
      if (history.current.length > SAMPLES) history.current.shift();
    }
    // Drawn while paused too, so a theme switch shows within a tenth of a second.
    draw(canvas, history.current);
  }, []);
  useLoudnessFeed(onReading);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      draw(canvas, history.current);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return <canvas ref={canvasRef} className="block h-[84px] w-full bg-background" />;
}
