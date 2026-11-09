import { useImperativeHandle, useRef, type Ref } from "react";
import { formatDb } from "@/modules/project";
import { meterHeight } from "../../logic/meter";
import type { GraphColours, LoudnessHistoryHandle } from "../../sound.types";
import { useGraphCanvas } from "./graph.canvas.hook";
import { LOUDNESS_INTERVAL_MS } from "./loudness.hook";

/** How much history shows: the last 60 s of readings. */
const SAMPLES = 60_000 / LOUDNESS_INTERVAL_MS;

/** Lines across the graph, in LUFS. */
const GRID = [-12, -24, -36, -48];

/** Draws the short-term loudness of the last 60 s, newest at the right. */
function draw(
  canvas: HTMLCanvasElement,
  colours: GraphColours,
  history: readonly number[],
  target: number | null,
) {
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
  if (target !== null) {
    // The delivery target, dashed in the pencil blue (the prototype's `--on` path, `4 3`).
    const scale = window.devicePixelRatio || 1;
    ctx.strokeStyle = colours.on;
    ctx.setLineDash([4 * scale, 3 * scale]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y(target)) + 0.5);
    ctx.lineTo(width, Math.round(y(target)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colours.on;
    ctx.font = `${10 * scale}px "Courier Prime", monospace`;
    ctx.textBaseline = target < -24 ? "bottom" : "top";
    ctx.fillText(
      `${formatDb(target, 0)} LUFS`,
      4 * scale,
      Math.round(y(target)) + (target < -24 ? -3 : 3) * scale,
    );
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
  /** The delivery target in LUFS, drawn as a dashed line; null draws none. */
  target: number | null;
  ref?: Ref<LoudnessHistoryHandle>;
}

/**
 * The short-term loudness over the last 60 s on a canvas, with lines every 12 LU and, when there
 * is a delivery target, a dashed line at it. The Loudness tab feeds it (`push`, `clear`). Colours
 * come from the theme's tokens (`useGraphCanvas`).
 */
export function LoudnessHistory({ shown, target, ref }: LoudnessHistoryProps) {
  const history = useRef<number[]>([]);
  const { canvasRef, redraw } = useGraphCanvas(shown, (canvas, colours) =>
    draw(canvas, colours, history.current, target),
  );

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

  return <canvas ref={canvasRef} className="block h-[84px] w-full bg-background" />;
}
