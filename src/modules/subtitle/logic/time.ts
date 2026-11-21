import { MICROS_PER_SECOND, type Micros } from "@/core";
import type { CueTimeField } from "../subtitle.types";

/** The shortest a cue's times can make it from the cue list or the timing keys: 0.2 s. */
export const MIN_CUE: Micros = 200_000;

/**
 * A typed time: seconds (`4.2`, `4.2s`), `m:ss.cc` (`0:04.20`) or `h:mm:ss.cc`. Null when it is
 * not one.
 */
export function parseTime(text: string): Micros | null {
  const parts = text.trim().replace(/\s*s$/, "").split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  if (parts.slice(0, -1).some((p) => p.includes("."))) return null;
  const seconds = parts.reduce((sum, p) => sum * 60 + Number(p), 0);
  return Math.round(seconds * MICROS_PER_SECOND);
}

/**
 * Where one time of a cue may go: between its neighbours (`prevEnd`, `nextStart`) and at least
 * `MIN_CUE` long (or as long as it already is, if shorter). `field` `"start"` and `"end"` are edge
 * times, `"length"` a length; `"move"` is a new start keeping the length. `clamped` says the value
 * had to change.
 */
export function clampCue(
  cue: { start: Micros; duration: Micros },
  bounds: { prevEnd: Micros; nextStart: Micros },
  field: CueTimeField | "move",
  value: Micros,
): { time: Micros; clamped: boolean } {
  const end = cue.start + cue.duration;
  const min = Math.min(MIN_CUE, cue.duration);
  const clamp = (lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), value));
  const time =
    field === "start"
      ? clamp(bounds.prevEnd, end - min)
      : field === "end"
        ? clamp(cue.start + min, bounds.nextStart)
        : field === "length"
          ? clamp(min, bounds.nextStart - cue.start)
          : clamp(bounds.prevEnd, bounds.nextStart - cue.duration);
  return { time, clamped: time !== value };
}
