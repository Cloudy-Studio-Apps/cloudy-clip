import { cn } from "../lib/cn";

/** Outline of a stylized waveform, as an SVG mask (stretched to its box). */
const WAVE_SVG = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>" +
    "<polygon points='0,40 8,20 16,45 24,10 32,35 40,0 48,30 56,15 64,40 72,5 80,30 88,20 100,40 100,60 88,80 80,70 72,95 64,60 56,85 48,70 40,100 32,65 24,90 16,55 8,80 0,60'/></svg>",
);

interface WaveformProps {
  /** Repeat the wave every this many px (long clips); omit to stretch one wave over the box. */
  tileWidth?: number;
  /** Position and color (the bars use `currentColor`, e.g. `text-ice-400`). */
  className?: string;
}

/** A decorative waveform drawn with thin bars, for audio that has no picture. */
export function Waveform({ tileWidth, className }: WaveformProps) {
  const size = tileWidth ? `${tileWidth}px 100%` : "100% 100%";
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none", className)}
      style={{
        background: "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 4px)",
        mask: `url("data:image/svg+xml,${WAVE_SVG}") left center / ${size} ${tileWidth ? "repeat-x" : "no-repeat"}`,
      }}
    />
  );
}
