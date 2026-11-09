import { useEffect, useRef } from "react";
import { useModule } from "@/core";
import { previewRef, SPECTRUM_BINS } from "@/modules/preview";
import { frequencyX, spectrumHeights } from "../../logic/spectrum";
import type { GraphColours } from "../../sound.types";
import { useGraphCanvas } from "./graph.canvas.hook";

/** Where the vertical lines fall, Hz. */
export const SPECTRUM_LINES = [100, 1000, 10000];

/** Draws the spectrum as a filled curve over the grid; nothing but the grid before there is a sound. */
function draw(
  canvas: HTMLCanvasElement,
  colours: GraphColours,
  bins: Float32Array,
  rate: number,
  heights: Float32Array,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = colours.grid;
  ctx.lineWidth = 1;
  for (const hz of SPECTRUM_LINES) {
    const x = Math.round(frequencyX(hz) * width) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (const part of [0.25, 0.5, 0.75]) {
    const y = Math.round(part * height) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  if (rate <= 0) return;
  const columns = heights.length;
  spectrumHeights(bins, rate, heights);
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let i = 0; i < columns; i++) {
    ctx.lineTo(((i + 0.5) / columns) * width, height - heights[i]! * height);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = colours.on;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colours.line;
  ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1);
  ctx.beginPath();
  for (let i = 0; i < columns; i++) {
    const x = ((i + 0.5) / columns) * width;
    const y = height - heights[i]! * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/**
 * The master's spectrum on a canvas, 20 Hz to 20 kHz on a log scale: while the timeline plays and
 * the tab shows, one `requestAnimationFrame` loop reads `PreviewSound.spectrum` (the master's
 * analyser) and draws it, with no React state; paused, the last picture stands.
 */
export function SpectrumGraph({ shown }: { shown: boolean }) {
  const preview = useModule(previewRef);
  const bins = useRef(new Float32Array(SPECTRUM_BINS).fill(-Infinity));
  const rate = useRef(0);
  const heights = useRef(new Float32Array(0));
  const { canvasRef, redraw } = useGraphCanvas(shown, (canvas, colours) => {
    // One column per two device pixels is plenty and keeps a frame cheap.
    const columns = Math.max(2, Math.floor(canvas.width / 2));
    if (heights.current.length !== columns) heights.current = new Float32Array(columns);
    draw(canvas, colours, bins.current, rate.current, heights.current);
  });

  useEffect(() => {
    if (!shown) return;
    const { playback, sound } = preview;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      rate.current = sound.spectrum(bins.current);
      redraw();
    };
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (playback.isPlaying()) tick();
    };
    follow();
    const off = playback.onPlayingChange(follow);
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, [preview, shown, redraw]);

  return <canvas ref={canvasRef} className="block h-[84px] w-full bg-background" />;
}
