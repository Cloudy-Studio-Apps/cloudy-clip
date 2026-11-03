import { useEffect, useRef } from "react";
import { METER_HOT_DB, METER_LOUD_DB, meterHeight } from "../../logic/meter";
import type { MeterTarget } from "../../sound.types";
import { useMeters } from "./meters.context";

const loud = meterHeight(METER_LOUD_DB) * 100;
const hot = meterHeight(METER_HOT_DB) * 100;

/** `--on` up to −6 dBFS, `--foreground` to −1, `--mark` above, laid over the whole height. */
const GRADIENT = `linear-gradient(to top, var(--on) 0 ${loud}%, var(--foreground) ${loud}% ${hot}%, var(--mark) ${hot}%)`;

interface MeterProps {
  target: MeterTarget;
  side: "left" | "right";
}

/**
 * One side of a peak meter, −60 to 0 dBFS, with its peak hold line. The mixer's meter loop writes
 * its height and hold through the DOM; this component never re-renders for a level.
 */
export function Meter({ target, side }: MeterProps) {
  const loop = useMeters();
  const barRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const hold = holdRef.current;
    if (!loop || !bar || !hold) return;
    return loop.register({ target, side, bar, hold });
  }, [loop, target, side]);

  return (
    <div className="relative w-[7px] overflow-hidden bg-surface-sunken">
      <div
        ref={barRef}
        className="absolute inset-0 [clip-path:inset(100%_0_0_0)]"
        style={{ backgroundImage: GRADIENT }}
      />
      <div ref={holdRef} className="invisible absolute inset-x-0 h-[1.5px] bg-foreground" />
    </div>
  );
}
