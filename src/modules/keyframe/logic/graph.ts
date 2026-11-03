import { MICROS_PER_SECOND } from "@/core";
import { clipEnd, contentTime, timeOfContent, trackValue } from "@/modules/project";
import type { Clip, Keyframe, KeyTrack } from "@/modules/project";
import { CURVE_KEY_RADIUS } from "../keyframe.layout";
import type {
  CurveDragKey,
  CurveSource,
  KeyBox,
  KeyRef,
  PanelClip,
  ShownCurve,
  ValueScale,
} from "../keyframe.types";
import { refId } from "./picking";

/** How many places along a clip's span are sampled to find the range its curve covers. */
const RANGE_SAMPLES = 64;

/** The number a key holds, or undefined for a key that isn't one. */
function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * How a track's values sit in a plane `height` px tall with `padding` above and below. The range
 * is sampled over the clip's span, so an overshoot fits, and widened when the curve is flat.
 */
export function valueScale(
  track: KeyTrack,
  clip: Clip,
  height: number,
  padding: number,
): ValueScale {
  let low = Infinity;
  let high = -Infinity;
  const take = (value: unknown) => {
    const n = numeric(value);
    if (n === undefined) return;
    low = Math.min(low, n);
    high = Math.max(high, n);
  };
  const end = clipEnd(clip);
  for (let i = 0; i <= RANGE_SAMPLES; i++) {
    take(
      trackValue(track, contentTime(clip, clip.start + ((end - clip.start) * i) / RANGE_SAMPLES)),
    );
  }
  for (const key of track.keys) {
    const time = timeOfContent(clip, key.t);
    if (time >= clip.start && time <= end) take(key.value);
  }
  if (!Number.isFinite(low)) {
    low = 0;
    high = 1;
  }
  if (high - low < 1e-9) {
    low -= 0.5;
    high += 0.5;
  }
  const plane = Math.max(1, height - 2 * padding);
  return {
    low,
    high,
    toY: (value) => height - padding - ((value - low) / (high - low)) * plane,
    toValue: (y) => low + ((height - padding - y) / plane) * (high - low),
  };
}

/** The sources with their scales for a plane of this height. `frozen` keeps the scales a drag began with. */
export function withScales(
  sources: readonly CurveSource[],
  height: number,
  padding: number,
  frozen?: ReadonlyMap<string, ValueScale>,
): ShownCurve[] {
  return sources.map((source) => ({
    ...source,
    scale: frozen?.get(source.id) ?? valueScale(source.track, source.clip, height, padding),
  }));
}

/** Where a key sits on the plane, in px from its top-left corner. Undefined for a key with no number. */
export function keyPoint(
  curve: ShownCurve,
  key: Keyframe,
  pxPerSecond: number,
  scrollLeft: number,
): { x: number; y: number } | undefined {
  const value = numeric(key.value);
  if (value === undefined) return undefined;
  const time = timeOfContent(curve.clip, key.t);
  return {
    x: (time / MICROS_PER_SECOND) * pxPerSecond - scrollLeft,
    y: curve.scale.toY(value),
  };
}

/**
 * The diamonds of the curves as boxes in screen px, for picking. `origin` is the plane's corner on
 * screen. Keys outside the view are left out.
 */
export function keyBoxes(
  curves: readonly ShownCurve[],
  pxPerSecond: number,
  scrollLeft: number,
  width: number,
  origin: { left: number; top: number },
): KeyBox[] {
  return curves.flatMap((curve) =>
    curve.track.keys.flatMap((key) => {
      const p = keyPoint(curve, key, pxPerSecond, scrollLeft);
      if (!p || p.x < -CURVE_KEY_RADIUS || p.x > width + CURVE_KEY_RADIUS) return [];
      const x = origin.left + p.x;
      const y = origin.top + p.y;
      return [
        {
          ref: { clipId: curve.clip.id, path: curve.path, keyId: key.id },
          box: {
            left: x - CURVE_KEY_RADIUS,
            top: y - CURVE_KEY_RADIUS,
            right: x + CURVE_KEY_RADIUS,
            bottom: y + CURVE_KEY_RADIUS,
          },
        },
      ];
    }),
  );
}

/**
 * The sources as a drag shows them: each dragged key at its new time and value, the track kept in
 * order. `dragged` holds the `clipId|path|keyId` of the keys that move.
 */
export function dragPreview(
  sources: readonly CurveSource[],
  dragged: ReadonlySet<string>,
  delta: number,
  values: ReadonlyMap<string, number>,
): CurveSource[] {
  return sources.map((source) => {
    const id = (key: Keyframe) => `${source.clip.id}|${source.path}|${key.id}`;
    if (!source.track.keys.some((key) => dragged.has(id(key)))) return source;
    const keys = source.track.keys
      .map((key) =>
        dragged.has(id(key))
          ? {
              ...key,
              t: contentTime(source.clip, timeOfContent(source.clip, key.t) + delta),
              value: values.get(id(key)) ?? key.value,
            }
          : key,
      )
      .sort((a, b) => a.t - b.t);
    return { ...source, track: { ...source.track, keys } };
  });
}

/**
 * The curves on show, with a color slot by row order. With nothing shown, the primary row is
 * (or the first number row when there is no primary), without touching the view.
 */
export function curveSources(
  rows: readonly PanelClip[],
  shown: readonly string[],
  primary: string | null,
): CurveSource[] {
  const all = rows.flatMap(({ clip, fields }) =>
    fields.map((field) => ({ clip, path: field.path, id: `${clip.id}:${field.path}` })),
  );
  const numbers = all.filter(({ clip, path }) => clip.animation?.[path]?.blend === "number");
  const fallback = numbers.find((r) => r.id === primary) ?? numbers[0];
  const on = shown.length > 0 ? new Set(shown) : new Set(fallback ? [fallback.id] : []);
  return all.flatMap(({ clip, path, id }, slot) => {
    const track = clip.animation?.[path];
    return track && track.blend === "number" && on.has(id)
      ? [{ id, clip, path, track, slot, primary: id === primary || (on.size === 1 && on.has(id)) }]
      : [];
  });
}

/** The selected keys that are on shown curves, as a drag needs them: time limits, scale, range. */
export function dragKeys(curves: readonly ShownCurve[], list: readonly KeyRef[]): CurveDragKey[] {
  const wanted = new Set(list.map(refId));
  return curves.flatMap((curve) =>
    curve.track.keys.flatMap((key) =>
      wanted.has(`${curve.clip.id}|${curve.path}|${key.id}`) && typeof key.value === "number"
        ? [
            {
              ref: { clipId: curve.clip.id, path: curve.path, keyId: key.id },
              moved: {
                time: timeOfContent(curve.clip, key.t),
                clipStart: curve.clip.start,
                clipEnd: clipEnd(curve.clip),
              },
              scale: curve.scale,
              value: key.value,
              ...(curve.track.min !== undefined && { min: curve.track.min }),
              ...(curve.track.max !== undefined && { max: curve.track.max }),
            },
          ]
        : [],
    ),
  );
}
