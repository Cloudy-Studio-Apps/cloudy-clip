import type { Micros } from "@/core";

/** The part of a composition's timeline that gets exported. */
export interface ExportRange {
  start: Micros;
  duration: Micros;
}

/** One stretch of a file's sound on the export's clock (mirrors `SoundSegment` in Rust). */
export interface SoundSegment {
  path: string;
  /** Where it starts in the export. */
  at: Micros;
  /** Where it starts in the file. */
  from: Micros;
  duration: Micros;
  fadeIn: Micros;
  fadeOut: Micros;
}
