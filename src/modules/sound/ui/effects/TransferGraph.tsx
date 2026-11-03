import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from "react";
import { dynamicsTransfer } from "@/modules/preview";
import { EFFECT_RANGES } from "@/modules/project";
import type { TransferEffect, TransferGraphHandle } from "../../sound.types";

const SIZE = 100;
/** The quietest level drawn, dBFS (the lowest threshold a gate takes); the loudest is 0. */
const FLOOR_DB = EFFECT_RANGES.gate.thresholdDb.min;
const STEPS = 80;

const at = (db: number) => (Math.min(0, Math.max(FLOOR_DB, db)) / FLOOR_DB) * SIZE;
const xOf = (db: number) => SIZE - at(db);
const yOf = (db: number) => at(db);

const thresholdOf = (effect: TransferEffect) =>
  effect.kind === "compressor" ? effect.params.thresholdDb : effect.thresholdDb;

interface TransferGraphProps {
  effect: TransferEffect;
  /** Lets a dragged value redraw the curve without a render. */
  ref?: Ref<TransferGraphHandle>;
}

/**
 * Level in against level out of a compressor or a gate, −80 to 0 dBFS: the even line for
 * reference, the curve from the preview's own gain (`dynamicsTransfer`), and the threshold marked.
 */
export function TransferGraph({ effect, ref }: TransferGraphProps) {
  const curve = useRef<SVGPathElement>(null);
  const point = useRef<SVGCircleElement>(null);

  const draw = (next: TransferEffect) => {
    const out = dynamicsTransfer(next);
    const points: string[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const db = FLOOR_DB - (FLOOR_DB * i) / STEPS;
      points.push(`${xOf(db).toFixed(2)} ${yOf(out(db)).toFixed(2)}`);
    }
    curve.current?.setAttribute("d", `M${points.join("L")}`);
    const threshold = thresholdOf(next);
    point.current?.setAttribute("cx", `${xOf(threshold)}`);
    point.current?.setAttribute("cy", `${yOf(out(threshold))}`);
  };
  useImperativeHandle(ref, () => ({ draw }));
  useLayoutEffect(() => draw(effect));

  return (
    <svg
      viewBox={`-4 -4 ${SIZE + 8} ${SIZE + 8}`}
      role="img"
      aria-label="Level in against level out"
      className="h-24 w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {[-60, -40, -20].map((db) => (
        <g key={db} stroke="var(--border)" strokeWidth={0.5}>
          <line x1={xOf(db)} x2={xOf(db)} y1={0} y2={SIZE} />
          <line x1={0} x2={SIZE} y1={yOf(db)} y2={yOf(db)} />
        </g>
      ))}
      <rect
        width={SIZE}
        height={SIZE}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={0.75}
      />
      <line x1={0} y1={SIZE} x2={SIZE} y2={0} stroke="var(--border-strong)" strokeWidth={0.75} />
      <path ref={curve} fill="none" stroke="var(--foreground)" strokeWidth={1.5} />
      <circle ref={point} r={3} fill="var(--surface)" stroke="var(--mark)" strokeWidth={1.5} />
    </svg>
  );
}
