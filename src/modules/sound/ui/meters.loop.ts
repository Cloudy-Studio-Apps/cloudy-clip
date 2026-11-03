import type { PreviewSound } from "@/modules/preview";
import { holdPeak, meterHeight } from "../logic/meter";
import type { MeterEntry, MeterLoop } from "../sound.types";

/** Writes a level to a meter side, touching the DOM only where something changed. */
function write(entry: MeterEntry, db: number, now: number): void {
  const height = meterHeight(db);
  if (height !== entry.height) {
    entry.height = height;
    entry.bar.style.clipPath = `inset(${(1 - height) * 100}% 0 0 0)`;
  }
  entry.peak = holdPeak(entry.peak, db, now);
  const hold = meterHeight(entry.peak.db);
  if (hold !== entry.holdHeight) {
    entry.holdHeight = hold;
    entry.hold.style.bottom = `${hold * 100}%`;
    entry.hold.style.visibility = hold > 0 ? "visible" : "hidden";
  }
}

/**
 * The meters' loop: while started, one `requestAnimationFrame` reads `levels()` and `input()` (the
 * microphone while recording, both sides) once and writes every registered meter side through the
 * DOM, with its peak hold. No React (rule 24).
 */
export function createMeterLoop(sound: PreviewSound, input: () => number): MeterLoop {
  const entries = new Set<MeterEntry>();
  let frame = 0;

  const tick = (now: number) => {
    const levels = sound.levels();
    const heard = input();
    for (const entry of entries) {
      if (entry.target === "input") {
        write(entry, heard, now);
        continue;
      }
      const level = entry.target === "master" ? levels.master : levels.tracks[entry.target];
      write(entry, level?.[entry.side] ?? -Infinity, now);
    }
    frame = requestAnimationFrame(tick);
  };

  return {
    register(meter) {
      const entry: MeterEntry = { ...meter, height: -1, holdHeight: -1, peak: null };
      write(entry, -Infinity, performance.now());
      entries.add(entry);
      return () => void entries.delete(entry);
    },
    start() {
      if (frame === 0) frame = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      const now = performance.now();
      for (const entry of entries) {
        entry.peak = null;
        write(entry, -Infinity, now);
      }
    },
  };
}
