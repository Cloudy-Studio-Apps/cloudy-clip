import type { GradientValueStop } from "./kit.types";

function rgba({ color, opacity }: GradientValueStop): string {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/** The stops left to right, as a CSS gradient for a bar. */
export function barBackground(stops: readonly GradientValueStop[]): string {
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  return `linear-gradient(90deg, ${sorted.map((s) => `${rgba(s)} ${s.at * 100}%`).join(", ")})`;
}

const hex = (value: number) => Math.round(value).toString(16).padStart(2, "0");

/** A new stop at `at` with the color the bar shows there, so adding one changes nothing yet. */
export function stopAt(stops: readonly GradientValueStop[], at: number): GradientValueStop {
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  const after = sorted.findIndex((s) => s.at >= at);
  const b = sorted[after === -1 ? sorted.length - 1 : after]!;
  const a = sorted[Math.max(0, after === -1 ? sorted.length - 1 : after - 1)]!;
  const p = b.at === a.at ? 0 : (at - a.at) / (b.at - a.at);
  const mix = (x: number, y: number) => x + (y - x) * p;
  const channel = (color: string, shift: number) => (parseInt(color.slice(1), 16) >> shift) & 255;
  const color = [16, 8, 0].map((s) => hex(mix(channel(a.color, s), channel(b.color, s)))).join("");
  return { at, color: `#${color}`, opacity: mix(a.opacity, b.opacity) };
}
