import type { Micros } from "@/core";
import { dbToLinear } from "@/modules/project";
import { lineLevel, lineSchedule } from "../logic/line";
import { glide } from "./engine.soundnodes";
import type { FaderLevel, FaderTarget } from "./engine.types";

/** How far ahead of the clock the line is scheduled, in timeline time. */
const AHEAD: Micros = 1_000_000;
/** Scheduled less than this far ahead (seconds), the next stretch is added. */
const REFILL = 0.5;
/** The clock this far from where the schedule has it (a seek, a loop) schedules again. */
const SLIP: Micros = 100_000;
/** How long the bus takes to reach the line when a schedule starts: short, without a click. */
const CATCH: Micros = 10_000;

/** Where a schedule stands: the timeline time at a context time, and how far it is written. */
interface Plan {
  time: Micros;
  at: number;
  until: Micros;
}

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
 * The level of a track bus's fader: the fader's volume, 0 when muted, or, when the track has a
 * volume line, the line with the fader's offset on top. While playing, the line is scheduled a
 * second ahead as straight ramps (`lineSchedule`), topped up as the clock goes, and scheduled
 * again on a seek, a loop or a change; paused, the fader glides to the line's level at the
 * playhead. `time` is the clock when the bus is made: the first level is set outright.
 */
export function createFaderLevel(
  param: AudioParam,
  context: BaseAudioContext,
  time: Micros,
): FaderLevel {
  let target: FaderTarget | null = null;
  let clock = time;
  let playing = false;
  let plan: Plan | null = null;
  /** The paused time the line's level was last set for. */
  let held: Micros | null = null;
  let started = false;

  const lineOf = (next: FaderTarget) =>
    !next.muted && next.line && next.line.keys.length > 0 ? next.line : undefined;

  const drop = () => {
    if (!plan) return;
    cancel(param, context);
    plan = null;
  };

  const apply = () => {
    const line = target && lineOf(target);
    if (!target || !line) return;
    const offset = target.offsetDb;
    if (!playing) {
      drop();
      if (held === clock) return;
      held = clock;
      glide(param, lineLevel(line, offset, clock), context);
      return;
    }
    held = null;
    const now = context.currentTime;
    if (plan && Math.abs(plan.time + (now - plan.at) * 1e6 - clock) > SLIP) drop();
    if (!plan) {
      cancel(param, context);
      param.linearRampToValueAtTime(lineLevel(line, offset, clock + CATCH), now + CATCH / 1e6);
      plan = { time: clock, at: now, until: clock + CATCH };
    }
    const { time: from, at } = plan;
    if (at + (plan.until - from) / 1e6 - now >= REFILL) return;
    const to = Math.round(from + (now - at) * 1e6) + AHEAD;
    for (const point of lineSchedule(line, offset, plan.until, to)) {
      param.linearRampToValueAtTime(point.gain, at + (point.at - from) / 1e6);
    }
    plan.until = to;
  };

  return {
    set(next) {
      const same =
        target !== null &&
        target.line === next.line &&
        target.offsetDb === next.offsetDb &&
        target.muted === next.muted;
      if (same) return;
      target = next;
      held = null;
      drop();
      const line = lineOf(next);
      if (!line) {
        const level = next.muted ? 0 : dbToLinear(next.offsetDb);
        if (started) glide(param, level, context);
        else param.value = level;
      } else if (!started) {
        param.value = lineLevel(line, next.offsetDb, clock);
        held = clock;
      }
      started = true;
      apply();
    },
    follow(time, isPlaying) {
      clock = time;
      playing = isPlaying;
      apply();
    },
  };
}
