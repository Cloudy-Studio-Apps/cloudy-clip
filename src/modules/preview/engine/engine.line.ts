import type { Micros } from "@/core";
import { dbToLinear, type KeyTrack } from "@/modules/project";
import type { LineAt } from "../preview.types";
import { lineLevel, lineSchedule, sameLines } from "../logic/line";
import { glide } from "./engine.soundnodes";
import type { FaderLevel, FaderTarget, LineLists, LinePlan } from "./engine.types";

/**
 * How far ahead of the clock the lines are scheduled, in timeline time. The clock plays at 1x
 * (there is no shuttle speed), so timeline time maps 1:1 to the context's time.
 */
const AHEAD: Micros = 1_000_000;
/** Scheduled less than this far ahead (seconds), the next stretch is added. */
const REFILL = 0.5;
/** The clock this far from where the schedule has it (a seek, a loop) schedules again. */
const SLIP: Micros = 100_000;
/** How long the bus takes to reach the line when a schedule starts: short, without a click. */
const CATCH: Micros = 10_000;

/** No volume lines: the one list every voice outside a placement, and every chain, starts with. */
export const NO_LINES: readonly LineAt[] = Object.freeze([]);

/** Drops what is scheduled after now, holding the level reached. */
function cancel(param: AudioParam, context: BaseAudioContext): void {
  const now = context.currentTime;
  // WebKitGTK may lack `cancelAndHoldAtTime`: hold by hand there.
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
    return;
  }
  const value = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(value, now);
}

/**
 * A gain that plays a `FaderTarget`: its volume, 0 when muted, or, with volume lines, the lines
 * with the volume as an offset on top (a track bus's fader; the lines of the tracks a clip sits in
 * inside placements, on its chain). While playing, the lines are scheduled a second ahead as
 * straight ramps (`lineSchedule`), never past where playback stops or goes round, topped up as
 * the clock goes, and scheduled again on a seek, a loop or a change; paused, the gain glides to
 * the lines' level at the playhead. `time` is the clock when it is made: the first level is set
 * outright.
 */
export function createFaderLevel(
  param: AudioParam,
  context: BaseAudioContext,
  time: Micros,
): FaderLevel {
  let target: FaderTarget | null = null;
  /** The target's lines that have keys, none when muted: worked out once per target. */
  let active: readonly LineAt[] = NO_LINES;
  let clock = time;
  let playing = false;
  let until = Infinity;
  let plan: LinePlan | null = null;
  /** The paused time the line's level was last set for. */
  let held: Micros | null = null;
  let started = false;

  const linesOf = (next: FaderTarget): readonly LineAt[] => {
    if (next.muted) return NO_LINES;
    const keyed = next.lines.every(({ line }) => line.keys.length > 0);
    return keyed ? next.lines : next.lines.filter(({ line }) => line.keys.length > 0);
  };

  const drop = () => {
    if (!plan) return;
    cancel(param, context);
    plan = null;
  };

  const apply = () => {
    const lines = active;
    if (!target || lines.length === 0) return;
    const offset = target.offsetDb;
    if (!playing) {
      drop();
      if (held === clock) return;
      held = clock;
      glide(param, lineLevel(lines, offset, clock), context);
      return;
    }
    held = null;
    const now = context.currentTime;
    if (plan && Math.abs(plan.time + (now - plan.at) * 1e6 - clock) > SLIP) drop();
    // A loop set while playing ends before what is scheduled.
    if (plan && until < plan.until && until > clock) drop();
    if (!plan) {
      cancel(param, context);
      param.linearRampToValueAtTime(lineLevel(lines, offset, clock + CATCH), now + CATCH / 1e6);
      plan = { time: clock, at: now, until: clock + CATCH };
    }
    const { time: from, at } = plan;
    if (at + (plan.until - from) / 1e6 - now >= REFILL) return;
    const to = Math.min(Math.round(from + (now - at) * 1e6) + AHEAD, until);
    if (to <= plan.until) return;
    for (const point of lineSchedule(lines, offset, plan.until, to)) {
      param.linearRampToValueAtTime(point.gain, at + (point.at - from) / 1e6);
    }
    plan.until = to;
  };

  return {
    set(next) {
      const same =
        target !== null &&
        sameLines(target.lines, next.lines) &&
        target.offsetDb === next.offsetDb &&
        target.muted === next.muted;
      if (same) return;
      target = next;
      active = linesOf(next);
      held = null;
      drop();
      const lines = active;
      if (lines.length === 0) {
        const level = next.muted ? 0 : dbToLinear(next.offsetDb);
        if (started) glide(param, level, context);
        else param.value = level;
      } else if (!started) {
        param.value = lineLevel(lines, next.offsetDb, clock);
        held = clock;
      }
      started = true;
      apply();
    },
    follow(time, isPlaying, end) {
      clock = time;
      playing = isPlaying;
      until = end;
      apply();
    },
  };
}

/**
 * Lists of volume lines, each made once for its (lines above, line, shift) and handed back the
 * same after, so a voice's lines cost nothing per frame and compare by identity. Per engine; an
 * entry goes with its line or list (weakly held).
 */
export function createLineLists(): LineLists {
  const made = new WeakMap<readonly LineAt[], WeakMap<KeyTrack, Map<Micros, readonly LineAt[]>>>();
  return {
    inside(above, line, shift) {
      if (!line) return above;
      let byLine = made.get(above);
      if (!byLine) made.set(above, (byLine = new WeakMap()));
      let byShift = byLine.get(line);
      if (!byShift) byLine.set(line, (byShift = new Map()));
      let lines = byShift.get(shift);
      if (!lines) byShift.set(shift, (lines = [...above, { line, shift }]));
      return lines;
    },
  };
}
