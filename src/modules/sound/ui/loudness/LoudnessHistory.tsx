import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { meterHeight } from "../../logic/meter";
import type { GraphColours, LoudnessHistoryHandle } from "../../sound.types";
import { LOUDNESS_INTERVAL_MS } from "./loudness.hook";

/** How much history shows: the last 60 s of readings. */
const SAMPLES = 60_000 / LOUDNESS_INTERVAL_MS;

/** Lines across the graph, in LUFS. */
const GRID = [-12, -24, -36, -48];

/** The theme's colours for the graph, read from the canvas's tokens. */
function readColours(canvas: HTMLCanvasElement): GraphColours {
  const style = getComputedStyle(canvas);
  return {
    grid: style.getPropertyValue("--border").trim(),
    line: style.getPropertyValue("--foreground").trim(),
  };
}

/** Draws the short-term loudness of the last 60 s, newest at the right. */
function draw(canvas: HTMLCanvasElement, colours: GraphColours, history: readonly number[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const y = (lufs: number) => height - meterHeight(lufs) * height;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = colours.grid;
  ctx.lineWidth = 1;
  for (const lufs of GRID) {
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y(lufs)) + 0.5);
    ctx.lineTo(width, Math.round(y(lufs)) + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = colours.line;
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

interface LoudnessHistoryProps {
  /** Whether its tab shows: nothing is drawn while it doesn't, and it catches up when it does. */
  shown: boolean;
  ref?: Ref<LoudnessHistoryHandle>;
}

/**
 * The short-term loudness over the last 60 s on a canvas, with lines every 12 LU. The Loudness tab
 * feeds it (`push`, `clear`). Colours come from the theme's tokens, read once and again when
 * `data-theme` on `<html>` changes.
 */
export function LoudnessHistory({ shown, ref }: LoudnessHistoryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<number[]>([]);
  const colours = useRef<GraphColours | null>(null);
  const visible = useRef(shown);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !visible.current || canvas.width <= 1) return;
    colours.current ??= readColours(canvas);
    draw(canvas, colours.current, history.current);
  };

  useImperativeHandle(ref, () => ({
    push(shortTerm) {
      history.current.push(shortTerm);
      if (history.current.length > SAMPLES) history.current.shift();
      redraw();
    },
    clear() {
      history.current = [];
      redraw();
    },
  }));

  useEffect(() => {
    visible.current = shown;
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
  }, []);

  return <canvas ref={canvasRef} className="block h-[84px] w-full bg-background" />;
}
