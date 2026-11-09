import {
  contentTime,
  soundOf,
  timeOfContent,
  trackValue,
  VOLUME_DB_MAX,
  VOLUME_DB_MIN,
  type Clip,
  type KeyTrack,
} from "@/modules/project";
import { pxToTime, timeToPx } from "@/modules/timeline";
import type { LineKey, LinePoint } from "../sound.types";
import { faderDb, faderPosition } from "./fader";

/** The path of the value the clip's line shows. */
export const VOLUME_PATH = "sound.volumeDb";

/** How far apart, in px, the points of a curved stretch are. */
const SAMPLE_PX = 8;
/** How far before a key, in px, the value before it is read, so a hold shows as a step. */
const STEP_PX = 0.01;

/** The keys of the clip's volume that sit on the clip, left to right, in px. */
export function lineKeys(clip: Clip, track: KeyTrack | undefined, pxPerSecond: number): LineKey[] {
  if (!track) return [];
  return track.keys.flatMap((key) => {
    const at = timeOfContent(clip, key.t) - clip.start;
    if (at < 0 || at >= clip.duration || typeof key.value !== "number") return [];
    return [{ keyId: key.id, x: timeToPx(at, pxPerSecond), db: key.value }];
  });
}

/** The level on the line `x` px from the clip's left edge. */
export function levelAt(clip: Clip, track: KeyTrack | undefined, x: number, pxPerSecond: number) {
  if (!track || track.keys.length === 0) return soundOf(clip).volumeDb;
  const at = clip.start + pxToTime(x, pxPerSecond);
  const value = trackValue(track, contentTime(clip, at));
  return typeof value === "number" ? value : soundOf(clip).volumeDb;
}

/**
 * The line to draw across `width` px: the static level when there are no keys, otherwise the keys
 * and the clip's ends, with extra points along stretches that bend (an ease other than linear).
 */
export function linePoints(
  clip: Clip,
  track: KeyTrack | undefined,
  width: number,
  pxPerSecond: number,
): LinePoint[] {
  const keys = lineKeys(clip, track, pxPerSecond);
  const at = (x: number) => ({ x, db: levelAt(clip, track, x, pxPerSecond) });
  if (!track || keys.length === 0) return [at(0), at(width)];
  const bends = track.keys.some((k) => k.ease !== undefined && k.ease.kind !== "linear");
  const xs = new Set<number>([0, width]);
  for (const key of keys) {
    xs.add(key.x);
    if (key.x > STEP_PX) xs.add(key.x - STEP_PX);
  }
  if (bends) for (let x = SAMPLE_PX; x < width; x += SAMPLE_PX) xs.add(x);
  return [...xs]
    .filter((x) => x >= 0 && x <= width)
    .sort((a, b) => a - b)
    .map(at);
}

/** Where a level sits in the line's box, as a percentage of its height from the top. */
export function levelTop(db: number): number {
  return (1 - faderPosition(db)) * 100;
}

/** The `points` of an SVG polyline: x in px, y in 0 to 100 (the box's height). */
export function polylineOf(points: readonly LinePoint[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${levelTop(p.db).toFixed(2)}`).join(" ");
}

/**
 * A point moved by the pointer's travel (`dx`, `dy` in px) in a box `height` px tall and a clip
 * `width` px wide: it stays on the clip, and its level within the volume range (a tenth of a dB).
 */
export function draggedPoint(
  from: LinePoint,
  dx: number,
  dy: number,
  height: number,
  width: number,
): LinePoint {
  const x = Math.min(Math.max(from.x + dx, 0), Math.max(0, width - 1));
  const position = Math.min(1, Math.max(0, faderPosition(from.db) - dy / Math.max(1, height)));
  return { x, db: Math.min(VOLUME_DB_MAX, Math.max(VOLUME_DB_MIN, faderDb(position))) };
}

/** The line with the point at `from` put at `to`, as a drag shows it before anything is written. */
export function movedLine(
  points: readonly LinePoint[],
  from: LinePoint,
  to: LinePoint,
): LinePoint[] {
  return [
    ...points.filter((p) => p.x !== from.x && p.x !== from.x - STEP_PX),
    { x: to.x, db: to.db },
  ].sort((a, b) => a.x - b.x);
}
