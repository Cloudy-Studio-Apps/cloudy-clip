import { MICROS_PER_SECOND, type Micros } from "@/core";
import type { ExportRange } from "../export.types";

/**
 * Frames are drawn this far into their time. A time rounded to microseconds can fall just before
 * the frame it names, and a seek there lands on the previous frame.
 */
const INTO_FRAME: Micros = 1000;

/** How many frames a stretch of a timeline has. */
export function frameCount(range: ExportRange, fps: number): number {
  return Math.ceil((range.duration * fps) / MICROS_PER_SECOND - 1e-9);
}

/** The moment frame `n` of a stretch shows. */
export function frameTime(range: ExportRange, fps: number, n: number): Micros {
  const time = range.start + Math.round((n * MICROS_PER_SECOND) / fps) + INTO_FRAME;
  return Math.min(time, range.start + range.duration - 1);
}
