import { MICROS_PER_SECOND } from "@/core";
import { timeOfContent } from "@/modules/project";
import type { Clip, KeyEase, Keyframe } from "@/modules/project";
import type {
  Bezier,
  CurveSource,
  EaseChange,
  HandleSpot,
  HandleState,
  KeyRef,
  Point,
  SegmentPair,
  ShownCurve,
  ValueScale,
} from "../keyframe.types";
import { keyPoint } from "./graph";
import { refId } from "./picking";

/** The bezier that moves exactly as a linear ease does: what Smooth handles turns a linear segment into. */
export const LINEAR_BEZIER: Bezier = { kind: "bezier", x1: 1 / 3, y1: 1 / 3, x2: 2 / 3, y2: 2 / 3 };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round = (n: number) => Math.round(n * 10000) / 10000;

/** The numbers of an ease's handles; anything but a bezier gives the linear equivalent. */
function bezierOf(ease: KeyEase | undefined): Bezier {
  return ease?.kind === "bezier" ? ease : LINEAR_BEZIER;
}

/** The value of a key, when it is a number. */
function numberOf(key: Keyframe): number | undefined {
  return typeof key.value === "number" && Number.isFinite(key.value) ? key.value : undefined;
}

/**
 * Where the handles of the segment from `left` to `right` sit, in content time and value: `out`
 * hangs from `left` (its ease's `x1, y1`), `in` from `right` (`x2, y2`). A segment that isn't a
 * bezier gives the places of its linear equivalent.
 */
export function handlePoints(left: Keyframe, right: Keyframe): { out: Point; in: Point } {
  const { x1, y1, x2, y2 } = bezierOf(left.ease);
  const dt = right.t - left.t;
  const from = typeof left.value === "number" ? left.value : 0;
  const dv = (typeof right.value === "number" ? right.value : from) - from;
  return {
    out: { t: left.t + x1 * dt, v: from + y1 * dv },
    in: { t: left.t + x2 * dt, v: from + y2 * dv },
  };
}

/**
 * The ease of the side that wasn't moved, on a smooth key. `before` is that side's ease and
 * `segments` has the moved side already in its new shape. The other handle keeps how far it
 * reaches in time and takes the moved handle's slope in real units (value per time), so the two
 * form one straight line through the key. It stays as it was when it can't (a vertical or flat
 * handle, a segment with no value change, or one that isn't a bezier).
 */
export function alignedEase(before: KeyEase, moved: "in" | "out", segments: SegmentPair): KeyEase {
  if (before.kind !== "bezier") return before;
  const { prev, next } = segments;
  if (prev.ease.kind !== "bezier" || next.ease.kind !== "bezier") return before;
  if (moved === "in") {
    const reach = (prev.ease.x2 - 1) * prev.dt;
    if (reach === 0 || next.dv === 0) return before;
    const slope = ((prev.ease.y2 - 1) * prev.dv) / reach;
    return { ...before, y1: round((slope * before.x1 * next.dt) / next.dv) };
  }
  const reach = next.ease.x1 * next.dt;
  if (reach === 0 || prev.dv === 0) return before;
  const slope = (next.ease.y1 * next.dv) / reach;
  return { ...before, y2: round(1 + (slope * (before.x2 - 1) * prev.dt) / prev.dv) };
}

/**
 * The handles of the primary curve's selected keys, on the plane in px: one on the right of a key
 * when its own segment is a bezier, one on the left when the previous key's is. Linear and named
 * segments show none.
 */
export function handleSpots(
  curve: ShownCurve,
  selected: ReadonlySet<string>,
  pxPerSecond: number,
  scrollLeft: number,
): HandleSpot[] {
  if (!curve.primary) return [];
  const { clip, track, scale } = curve;
  const keys = track.keys;
  const ref = (key: Keyframe): KeyRef => ({ clipId: clip.id, path: curve.path, keyId: key.id });
  const px = (p: Point) => ({
    x: (timeOfContent(clip, p.t) / MICROS_PER_SECOND) * pxPerSecond - scrollLeft,
    y: scale.toY(p.v),
  });
  const shape = (left: Keyframe, right: Keyframe) => ({
    dt: timeOfContent(clip, right.t) - timeOfContent(clip, left.t),
    dv: (numberOf(right) ?? 0) - (numberOf(left) ?? 0),
    ease: left.ease ?? LINEAR_BEZIER,
  });
  const spots: HandleSpot[] = [];
  keys.forEach((key, i) => {
    if (!selected.has(refId(ref(key)))) return;
    const anchor = keyPoint(curve, key, pxPerSecond, scrollLeft);
    if (!anchor) return;
    const before = keys[i - 1];
    const after = keys[i + 1];
    const segments =
      key.smooth && before?.ease?.kind === "bezier" && key.ease?.kind === "bezier" && after
        ? { prev: shape(before, key), next: shape(key, after) }
        : undefined;
    const edit = (
      side: "in" | "out",
      left: Keyframe,
      right: Keyframe,
      follow: Keyframe | undefined,
    ) => {
      if (left.ease?.kind !== "bezier") return;
      const from = numberOf(left);
      const to = numberOf(right);
      if (from === undefined || to === undefined) return;
      const point = px(handlePoints(left, right)[side]);
      spots.push({
        key: ref(key),
        side,
        owner: ref(left),
        start: timeOfContent(clip, left.t),
        end: timeOfContent(clip, right.t),
        from,
        dv: to - from,
        ease: left.ease,
        ...point,
        anchor,
        ...(segments && follow && { follow: { owner: ref(follow), segments } }),
      });
    };
    if (before) edit("in", before, key, key);
    if (after) edit("out", key, after, before);
  });
  return spots;
}

/**
 * The eases a handle at a time and value gives: its own segment's, with x kept between the two
 * keys and y free (a segment with no value change only moves in x), and on a smooth key the other
 * side's, turned to stay in line.
 */
export function handleEases(spot: HandleSpot, time: number, value: number): HandleState {
  const ease = spot.ease.kind === "bezier" ? spot.ease : LINEAR_BEZIER;
  const dt = spot.end - spot.start;
  const x = dt === 0 ? undefined : round(clamp01((time - spot.start) / dt));
  const y = spot.dv === 0 ? undefined : round((value - spot.from) / spot.dv);
  const moved: Bezier =
    spot.side === "out"
      ? { ...ease, x1: x ?? ease.x1, y1: y ?? ease.y1 }
      : { ...ease, x2: x ?? ease.x2, y2: y ?? ease.y2 };
  const result = new Map<string, KeyEase>([[refId(spot.owner), moved]]);
  const { follow } = spot;
  if (follow) {
    const segments: SegmentPair =
      spot.side === "out"
        ? { prev: follow.segments.prev, next: { ...follow.segments.next, ease: moved } }
        : { prev: { ...follow.segments.prev, ease: moved }, next: follow.segments.next };
    const other = spot.side === "out" ? segments.prev.ease : segments.next.ease;
    result.set(refId(follow.owner), alignedEase(other, spot.side, segments));
  }
  return result;
}

/**
 * What a handle gives for the pointer moved by `dx, dy` px from where the handle sat, on the
 * scale the drag began with.
 */
export function handleDrag(
  spot: HandleSpot,
  scale: ValueScale,
  pxPerSecond: number,
  scrollLeft: number,
): (dx: number, dy: number) => HandleState {
  return (dx, dy) =>
    handleEases(
      spot,
      ((spot.x + dx + scrollLeft) / pxPerSecond) * MICROS_PER_SECOND,
      scale.toValue(spot.y + dy),
    );
}

/** The sources with these eases set on the keys that own them, as a handle drag shows them. */
export function withEases(sources: readonly CurveSource[], eases: HandleState): CurveSource[] {
  return sources.map((source) => {
    const id = (key: Keyframe) => `${source.clip.id}|${source.path}|${key.id}`;
    if (!source.track.keys.some((key) => eases.has(id(key)))) return source;
    const keys = source.track.keys.map((key) => {
      const ease = eases.get(id(key));
      return ease ? { ...key, ease } : key;
    });
    return { ...source, track: { ...source.track, keys } };
  });
}

/** Whether Smooth handles is on: every selected key (that exists) is smooth. */
export function allSmooth(
  clips: Readonly<Record<string, Clip>>,
  selection: readonly KeyRef[],
): boolean {
  const found = selection.flatMap((ref) => {
    const key = clips[ref.clipId]?.animation?.[ref.path]?.keys.find((k) => k.id === ref.keyId);
    return key ? [key] : [];
  });
  return found.length > 0 && found.every((key) => key.smooth);
}

/**
 * The changes for Smooth handles. Turning it on sets `smooth` on the selected keys of number
 * tracks and turns their linear segments on both sides into the bezier that moves the same, so
 * there is a handle to drag. Turning it off only clears `smooth`.
 */
export function smoothChanges(
  clips: Readonly<Record<string, Clip>>,
  selection: readonly KeyRef[],
  on: boolean,
): EaseChange[] {
  const changes = new Map<string, EaseChange>();
  const edit = (ref: KeyRef): EaseChange => {
    const id = refId(ref);
    const found = changes.get(id) ?? { key: ref };
    changes.set(id, found);
    return found;
  };
  const isLinear = (key: Keyframe) => key.ease === undefined || key.ease.kind === "linear";
  for (const ref of selection) {
    const track = clips[ref.clipId]?.animation?.[ref.path];
    const i = track?.keys.findIndex((k) => k.id === ref.keyId) ?? -1;
    if (!track || i < 0 || track.blend !== "number") continue;
    edit(ref).smooth = on;
    if (!on) continue;
    const key = track.keys[i]!;
    const before = track.keys[i - 1];
    if (track.keys[i + 1] && isLinear(key)) edit(ref).ease = LINEAR_BEZIER;
    if (before && isLinear(before)) {
      edit({ clipId: ref.clipId, path: ref.path, keyId: before.id }).ease = LINEAR_BEZIER;
    }
  }
  return [...changes.values()];
}
