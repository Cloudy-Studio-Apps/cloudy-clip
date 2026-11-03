import type { Micros } from "@/core";
import type { Clip, KeyTrack, RampTable } from "../project.types";
import { trackValue } from "./animate";

/** The path of the track that turns a clip's speed into a ramp. */
export const RAMP_PATH = "speed.rate";

/** Cells of content the table measures: one per 1/120 s. */
const CELL: Micros = 1_000_000 / 120;

/** One table per track, which is never changed in place. */
const tables = new WeakMap<KeyTrack, RampTable>();

/** A clip's ramp, or undefined when one speed plays it. */
export function rampOf(clip: Pick<Clip, "animation">): KeyTrack | undefined {
  return clip.animation?.[RAMP_PATH];
}

/** The rate at a time on the clip's content. */
export function rampRate(track: KeyTrack, t: Micros): number {
  return Number(trackValue(track, t));
}

/**
 * `∫ dc / rate(c)` between the first and last key. Cells end on the keys and read the rate at
 * their middle, so a held key changes the rate exactly where it sits.
 */
function tableOf(track: KeyTrack): RampTable {
  const cached = tables.get(track);
  if (cached) return cached;
  const { keys } = track;
  const contents = [keys[0]!.t];
  const times = [0];
  let elapsed = 0;
  for (let i = 1; i < keys.length; i++) {
    const from = keys[i - 1]!.t;
    const length = keys[i]!.t - from;
    const cells = Math.ceil(length / CELL);
    for (let cell = 0; cell < cells; cell++) {
      elapsed += length / cells / rampRate(track, from + ((cell + 0.5) * length) / cells);
      contents.push(from + ((cell + 1) * length) / cells);
      times.push(elapsed);
    }
  }
  const table = {
    contents,
    times,
    firstRate: rampRate(track, keys[0]!.t),
    lastRate: rampRate(track, keys[keys.length - 1]!.t),
  };
  tables.set(track, table);
  return table;
}

/** `at` on the rising line `from`, read on `to`; past either end it runs on at those slopes. */
function across(
  from: readonly number[],
  to: readonly number[],
  at: number,
  slopeBefore: number,
  slopeAfter: number,
): number {
  const last = from.length - 1;
  if (at <= from[0]!) return to[0]! + (at - from[0]!) * slopeBefore;
  if (at >= from[last]!) return to[last]! + (at - from[last]!) * slopeAfter;
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (from[middle]! <= at) low = middle;
    else high = middle;
  }
  const share = (at - from[low]!) / (from[high]! - from[low]!);
  return to[low]! + (to[high]! - to[low]!) * share;
}

/** The ramp's own clock at a content time. */
function clockAt(table: RampTable, content: Micros): number {
  return across(table.contents, table.times, content, 1 / table.firstRate, 1 / table.lastRate);
}

/**
 * The timeline length of the content `from..to`, negative when `to` comes first. Before the first
 * key the first rate plays, after the last key the last one.
 */
export function rampTimeAt(track: KeyTrack, from: Micros, to: Micros): Micros {
  const table = tableOf(track);
  return Math.round(clockAt(table, to) - clockAt(table, from));
}

/** The content reached `elapsed` of timeline time after content `from`: `rampTimeAt`'s inverse. */
export function rampContentAt(track: KeyTrack, from: Micros, elapsed: Micros): Micros {
  const table = tableOf(track);
  const clock = clockAt(table, from) + elapsed;
  return Math.round(across(table.times, table.contents, clock, table.firstRate, table.lastRate));
}
