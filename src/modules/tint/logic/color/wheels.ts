import { ZONE_NAMES, type CorrectionValues, type Wheel } from "@/modules/project";
import type { LogParams, Rgb, ZoneParams } from "../../tint.types";
import { luma, smoothstep } from "./basics";

// The primary wheels: lift, gamma, gain and offset, as the CPU reference (`render/correct.glsl.ts`
// is the GLSL). Each wheel becomes one number per channel, worked out once per correction:
// - The puck (x right, y down, as `ColorWheel` draws it) points at a hue on the ring, red at the top
//   and clockwise (red 0°, green 120°, blue 240°). Channel c moves by `x sin(h_c) - y cos(h_c)`:
//   the puck's reach toward that channel's hue. The three always add up to 0.
// - The master ring `m` moves all three channels alike.
// Then `out = gain (in + lift (1 - in))^(1 / gamma) + offset`, per channel. A base below 0 isn't
// raised to the power: it goes through as it is, which meets the curve at 0.
//
// The log and zone wheels follow the primary ones, in the same step. Each adds its numbers
// (`LOG_REACH`, `ZONE_REACH`, like offset) weighted by a band over the luma after the primary
// wheels (one luma for all of them, so they don't feed each other):
// - Log: shadow `1 - smoothstep(0, low, y)`, highlight `smoothstep(high, 1, y)`, midtone what is
//   left of both, `(1 - shadow)(1 - highlight)`. `low` is `lowRange` and `high` `highRange`, kept
//   `LOG_EDGE` off 0 and 1 so a band never has no width.
// - Zones: each `1 - smoothstep(0, ZONE_WIDTH, |y - at|)`, a bump around its `at`.

/** Hue of each channel on the wheel, clockwise from the top. */
const CHANNEL_HUES = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3] as const;

/** How far each wheel moves a channel: its master ring, and its color at the edge of the wheel. */
export const WHEEL_REACH = {
  /** Added to `in` toward white: `lift` at its edge. */
  lift: { m: 0.5, color: 0.25 },
  /** Exponent of 2 of the gamma. */
  gamma: { m: 1, color: 0.5 },
  /** Exponent of 2 of the gain. */
  gain: { m: 1, color: 0.5 },
  /** Added. */
  offset: { m: 0.25, color: 0.15 },
} as const;

/** One number per channel for a wheel: `m · reach.m + color toward the puck · reach.color`. */
export function wheelChannels(wheel: Wheel, reach: { m: number; color: number }): Rgb {
  const out = CHANNEL_HUES.map(
    (h) => wheel.m * reach.m + (wheel.x * Math.sin(h) - wheel.y * Math.cos(h)) * reach.color,
  );
  return [out[0]!, out[1]!, out[2]!];
}

/** What the primary wheels do to each channel. */
export function primaryWheels(values: CorrectionValues): {
  lift: Rgb;
  gammaInv: Rgb;
  gain: Rgb;
  offset: Rgb;
} {
  const pow2 = (rgb: Rgb, sign: number): Rgb => [
    2 ** (sign * rgb[0]),
    2 ** (sign * rgb[1]),
    2 ** (sign * rgb[2]),
  ];
  return {
    lift: wheelChannels(values.lift, WHEEL_REACH.lift),
    // A gamma of 2^g, so its inverse is 2^-g: up brightens the midtones.
    gammaInv: pow2(wheelChannels(values.gamma, WHEEL_REACH.gamma), -1),
    gain: pow2(wheelChannels(values.gain, WHEEL_REACH.gain), 1),
    offset: wheelChannels(values.offset, WHEEL_REACH.offset),
  };
}

/** One channel through lift, gamma, gain and offset. */
export function primaryChannel(
  x: number,
  lift: number,
  gammaInv: number,
  gain: number,
  offset: number,
): number {
  const base = x + lift * (1 - x);
  return gain * (base > 0 ? Math.pow(base, gammaInv) : base) + offset;
}

/** How far a puck may go from the middle of its ring, as a share of the ring's radius. */
export const PUCK_REACH = 0.8;

/** A wheel with its puck moved to `(dx, dy)` px from the ring's middle (y down) on a ring of `radius` px; the master stays. */
export function wheelPuckAt(wheel: Wheel, dx: number, dy: number, radius: number): Wheel {
  const scale = radius * PUCK_REACH;
  let x = dx / scale;
  let y = dy / scale;
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, m: wheel.m };
}

/** The color part of a wheel per channel (red, green, blue): how far the puck points at each. They add up to 0. */
export function wheelColorNumbers(wheel: Wheel): Rgb {
  return wheelChannels({ x: wheel.x, y: wheel.y, m: 0 }, { m: 0, color: 1 });
}

/** The wheel with one channel's color part set to `value` (0 red, 1 green, 2 blue): the puck moves along that channel's hue. */
export function wheelWithChannel(wheel: Wheel, channel: 0 | 1 | 2, value: number): Wheel {
  const h = CHANNEL_HUES[channel];
  const delta = value - wheelColorNumbers(wheel)[channel];
  const moved = wheelPuckAt(
    wheel,
    (wheel.x + delta * Math.sin(h)) * PUCK_REACH,
    (wheel.y - delta * Math.cos(h)) * PUCK_REACH,
    1,
  );
  return moved;
}

/** How far the log wheels move a channel: added, like offset. */
export const LOG_REACH = { m: 0.25, color: 0.15 } as const;
/** How close to 0 and 1 the log ranges may come. */
export const LOG_EDGE = 0.01;
/** How far a zone wheel moves a channel: added. */
export const ZONE_REACH = { m: 0.2, color: 0.12 } as const;
/** Half the width of a zone's band, over luma. */
export const ZONE_WIDTH = 0.18;

const moves = (wheel: Wheel) => wheel.x !== 0 || wheel.y !== 0 || wheel.m !== 0;

/** The log wheels worked out, or null when none moves anything. */
export function logWheels(values: CorrectionValues): LogParams | null {
  const { shadow, midtone, highlight, lowRange, highRange } = values.log;
  if (!moves(shadow) && !moves(midtone) && !moves(highlight)) return null;
  return {
    shadow: wheelChannels(shadow, LOG_REACH),
    midtone: wheelChannels(midtone, LOG_REACH),
    highlight: wheelChannels(highlight, LOG_REACH),
    low: Math.max(lowRange, LOG_EDGE),
    high: Math.min(highRange, 1 - LOG_EDGE),
  };
}

/** The zone wheels worked out, or null when none moves anything. */
export function zoneWheels(values: CorrectionValues): ZoneParams | null {
  const zones = ZONE_NAMES.map((name) => values.zones[name]);
  if (!zones.some(moves)) return null;
  return {
    add: zones.flatMap((zone) => wheelChannels(zone, ZONE_REACH)),
    at: zones.map((zone) => zone.at),
  };
}

/** The weights of the log wheels at luma `y`: shadow, midtone, highlight. */
export function logWeights(y: number, low: number, high: number): Rgb {
  const shadow = 1 - smoothstep(0, low, y);
  const highlight = smoothstep(high, 1, y);
  return [shadow, (1 - shadow) * (1 - highlight), highlight];
}

/** The log and zone wheels on a color, after the primary ones. */
export function toneWheels(rgb: Rgb, log: LogParams | null, zones: ZoneParams | null): Rgb {
  const y = luma(rgb);
  const out = [rgb[0], rgb[1], rgb[2]];
  if (log) {
    const [ws, wm, wh] = logWeights(y, log.low, log.high);
    for (let i = 0; i < 3; i++) {
      out[i] = out[i]! + ws * log.shadow[i]! + wm * log.midtone[i]! + wh * log.highlight[i]!;
    }
  }
  if (zones) {
    for (let z = 0; z < zones.at.length; z++) {
      const w = 1 - smoothstep(0, ZONE_WIDTH, Math.abs(y - zones.at[z]!));
      for (let i = 0; i < 3; i++) out[i] = out[i]! + w * zones.add[z * 3 + i]!;
    }
  }
  return [out[0]!, out[1]!, out[2]!];
}

/** The four numbers a wheel shows (as numbers or as bars): its master, then its color part per channel. */
export function wheelNumbers(wheel: Wheel): [number, number, number, number] {
  const [r, g, b] = wheelColorNumbers(wheel);
  return [wheel.m, r, g, b];
}

/** The wheel with one of its four numbers (0 the master, 1 to 3 red, green, blue) set to `value`. */
export function wheelWithNumber(wheel: Wheel, index: number, value: number): Wheel {
  if (index === 0) return { ...wheel, m: value };
  return wheelWithChannel(wheel, (index - 1) as 0 | 1 | 2, value);
}
