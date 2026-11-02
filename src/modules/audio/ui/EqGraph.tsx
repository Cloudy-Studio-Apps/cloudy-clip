import { useLayoutEffect, useRef } from "react";
import type { EqBand } from "@/modules/project";
import { cn } from "@/ui";
import { eqResponse } from "../logic/eq";
import { startEqDrag } from "./eq.gesture";

const WIDTH = 240;
const HEIGHT = 136;
const GUTTER = 26;
const MIN_HZ = 20;
const MAX_HZ = 20000;
const RANGE_DB = 24;
const SAMPLE_RATE = 48000;
const STEPS = 120;

const SPAN = Math.log2(MAX_HZ / MIN_HZ);
const xOf = (hz: number) => (Math.log2(hz / MIN_HZ) / SPAN) * WIDTH;
const hzAt = (x: number) => MIN_HZ * 2 ** ((x / WIDTH) * SPAN);
const yOf = (db: number) => HEIGHT / 2 - (db / RANGE_DB) * (HEIGHT / 2);
const dbAt = (y: number) => ((HEIGHT / 2 - y) / (HEIGHT / 2)) * RANGE_DB;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const isCut = (band: EqBand) => band.shape === "lowCut" || band.shape === "highCut";

/** The curve of the bands through the graph. */
function curveOf(bands: readonly EqBand[]): string {
  const points: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const x = (i / STEPS) * WIDTH;
    const y = yOf(clamp(eqResponse(bands, hzAt(x), SAMPLE_RATE), -RANGE_DB, RANGE_DB));
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M${points.join("L")}`;
}

interface EqGraphProps {
  bands: readonly EqBand[];
  disabled: boolean;
  /** Fires per move of a point; the graph redraws itself. */
  onInput(bands: EqBand[]): void;
  /** Fires once, on release. */
  onCommit(bands: EqBand[]): void;
}

/** The equalizer's curve with its six numbered points. Gain reads on the right only. */
export function EqGraph({ bands, disabled, onInput, onCommit }: EqGraphProps) {
  const svg = useRef<SVGSVGElement>(null);
  const curve = useRef<SVGPathElement>(null);
  const fill = useRef<SVGPathElement>(null);

  const paint = (next: readonly EqBand[]) => {
    const line = curveOf(next);
    curve.current?.setAttribute("d", line);
    fill.current?.setAttribute("d", `${line}L${WIDTH} ${yOf(0)}L0 ${yOf(0)}Z`);
    next.forEach((band, i) => {
      const node = svg.current?.querySelector<SVGGElement>(`[data-band="${i}"]`);
      const y = isCut(band) ? yOf(0) : yOf(band.db);
      node?.setAttribute("transform", `translate(${xOf(band.hz)} ${y})`);
    });
  };
  useLayoutEffect(() => paint(bands));

  const withBand = (index: number, band: EqBand) =>
    bands.map((one, i) => (i === index ? band : one));

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${WIDTH + GUTTER} ${HEIGHT + 18}`}
      role="img"
      aria-label="Equalizer curve"
      className={cn("w-full touch-none select-none", disabled && "opacity-40")}
    >
      {[-24, -12, 0, 12, 24].map((db) => (
        <g key={db}>
          <line x1={0} x2={WIDTH} y1={yOf(db)} y2={yOf(db)} stroke="var(--border)" />
          <text
            x={WIDTH + 4}
            y={clamp(yOf(db) + 3, 8, HEIGHT)}
            fontSize={9}
            fill="var(--subtle-foreground)"
            className="font-mono"
          >
            {db > 0 ? `+${db}` : db}
          </text>
        </g>
      ))}
      {[100, 1000, 10000].map((hz) => (
        <g key={hz}>
          <line x1={xOf(hz)} x2={xOf(hz)} y1={0} y2={HEIGHT} stroke="var(--border)" />
          <text
            x={xOf(hz)}
            y={HEIGHT + 12}
            fontSize={9}
            textAnchor="middle"
            fill="var(--subtle-foreground)"
            className="font-mono"
          >
            {hz >= 1000 ? `${hz / 1000}K` : hz}
          </text>
        </g>
      ))}
      <path ref={fill} fill="var(--primary)" opacity={0.12} />
      <path ref={curve} fill="none" stroke="var(--on)" strokeWidth={1.5} />
      {bands.map((band, index) => (
        <g
          key={index}
          data-band={index}
          aria-label={`Band ${index + 1}`}
          className={disabled || !band.on ? "opacity-40" : "cursor-grab"}
          onPointerDown={(event) => {
            if (disabled || !band.on || event.button !== 0 || !svg.current) return;
            const toBand = (x: number, y: number): EqBand => ({
              ...band,
              hz: Math.round(hzAt(clamp(x, 0, WIDTH))),
              db: isCut(band) ? 0 : Math.round(clamp(dbAt(y), -RANGE_DB, RANGE_DB) * 2) / 2,
            });
            startEqDrag(
              event.nativeEvent,
              svg.current,
              toBand,
              (next) => {
                const all = withBand(index, next);
                paint(all);
                onInput(all);
              },
              (next) => onCommit(withBand(index, next)),
            );
          }}
        >
          <circle r={8} fill="var(--surface)" stroke="var(--on)" strokeWidth={1.5} />
          <text
            y={3}
            fontSize={9}
            textAnchor="middle"
            fill="var(--foreground)"
            className="pointer-events-none font-mono font-bold"
          >
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
