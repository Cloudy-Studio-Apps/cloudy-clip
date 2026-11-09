import type { Micros } from "@/core";
import {
  simplify,
  trackValue,
  VOLUME_DB_MAX,
  VOLUME_DB_MIN,
  type KeyTrack,
} from "@/modules/project";
import type { AutomationMode, LevelAt } from "../sound.types";

/** How far, in dB, a written point may sit off the straight line and still be dropped. */
export const THIN_DB = 0.5;

/** The modes in the order a click goes through them. */
const MODES: readonly AutomationMode[] = ["read", "touch", "latch"];

/** The mode after `mode`: Read, Touch, Latch, then Read again. */
export function nextMode(mode: AutomationMode): AutomationMode {
  return MODES[(MODES.indexOf(mode) + 1) % MODES.length]!;
}

/** How a mode is named on its button and in the timeline's tools. */
export function modeName(mode: AutomationMode): string {
  return mode === "read" ? "Read" : mode === "touch" ? "Touch" : "Latch";
}

/** The level of a track's volume line at a timeline time: 0 dB when it has none. */
export function lineDb(line: KeyTrack | undefined, at: Micros): number {
  if (!line || line.keys.length === 0) return 0;
  const value = trackValue(line, at);
  return typeof value === "number" ? value : 0;
}

/** A level brought inside the volume range. */
export function clampDb(db: number): number {
  return Math.min(VOLUME_DB_MAX, Math.max(VOLUME_DB_MIN, db));
}

/**
 * Levels in time order, one per time (a later one wins), thinned to the points within 0.5 dB of
 * the line through them: a stroke or a pass sends tens of points, not thousands.
 */
export function thinLevels(levels: readonly LevelAt[]): LevelAt[] {
  const byTime = new Map<Micros, number>();
  for (const { at, db } of levels) byTime.set(at, db);
  const sorted = [...byTime].sort((a, b) => a[0] - b[0]).map(([at, value]) => ({ at, value }));
  return simplify(sorted, THIN_DB).map(({ at, value }) => ({ at, db: value }));
}
