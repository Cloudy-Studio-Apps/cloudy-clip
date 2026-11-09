import type { Micros } from "@/core";
import {
  simplify,
  trackValue,
  VOLUME_DB_MAX,
  VOLUME_DB_MIN,
  type KeyTrack,
} from "@/modules/project";
import type { AutomationMode, LevelAt, PassSpan } from "../sound.types";

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

/** How often an eased stretch of a line is read when a pass keeps its shape (µs). */
const EASED_STEP: Micros = 100_000;

/** Whether the line's stretch through `at` bends (its key before `at` has an ease other than linear). */
function bendsAt(line: KeyTrack | undefined, at: Micros): boolean {
  const before = line?.keys.filter((key) => key.t <= at).at(-1);
  return before?.ease !== undefined && before.ease.kind !== "linear";
}

/**
 * The line's own levels from `from` to `to` (both kept): its keys there and, where it bends, a
 * level every 100 ms, so points written over the stretch keep its shape.
 */
export function lineStretch(line: KeyTrack | undefined, from: Micros, to: Micros): LevelAt[] {
  if (to < from) return [];
  const times = new Set<Micros>([from, to]);
  for (const key of line?.keys ?? []) if (key.t > from && key.t < to) times.add(key.t);
  for (let at = from + EASED_STEP; at < to; at += EASED_STEP) {
    if (bendsAt(line, at)) times.add(at);
  }
  return [...times].sort((a, b) => a - b).map((at) => ({ at, db: lineDb(line, at) }));
}

/**
 * Where a Touch release returns: the line's own level at `at` and, when the line bends there, its
 * levels until just before its next key, so the stretch after the release keeps its curve.
 */
export function returnToLine(line: KeyTrack | undefined, at: Micros): LevelAt[] {
  const next = line?.keys.find((key) => key.t > at);
  if (!next || !bendsAt(line, at) || next.t - 1 <= at) return [{ at, db: lineDb(line, at) }];
  return lineStretch(line, at, next.t - 1);
}

/**
 * The stretches a whole pass wrote, ready for `sound.writePasses`: its laps in the order written, a
 * later lap replacing an earlier one where their spans overlap, joined into disjoint spans in time
 * order, each thinned (`thinLevels`). What lies between laps that don't touch (a seek ahead) is in
 * no span, so the line there stays as it is. Empty when nothing was written.
 */
export function passSpans(laps: readonly LevelAt[][]): PassSpan[] {
  const written = new Map<Micros, number>();
  const spans: [Micros, Micros][] = [];
  for (const lap of laps) {
    const first = lap[0];
    const last = lap[lap.length - 1];
    if (!first || !last) continue;
    for (const at of written.keys()) if (at >= first.at && at <= last.at) written.delete(at);
    for (const { at, db } of lap) written.set(at, db);
    spans.push([first.at, last.at]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const joined: [Micros, Micros][] = [];
  for (const [from, to] of spans) {
    const previous = joined[joined.length - 1];
    if (previous && from <= previous[1]) previous[1] = Math.max(previous[1], to);
    else joined.push([from, to]);
  }
  return joined.map(([from, to]) => ({
    from,
    to,
    points: thinLevels(
      [...written].filter(([at]) => at >= from && at <= to).map(([at, db]) => ({ at, db })),
    ),
  }));
}
