import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import {
  clampToClip,
  contentTime,
  formatOf,
  frameDuration,
  insertPoint,
  projectRef,
  withoutTracks,
  type KeyTrack,
  type PathPoint,
  type PointId,
} from "@/modules/project";
import { requireMask, requirePictureClip } from "./mask.guards";
import { maskPoint } from "./mask.schema";
import {
  dropFlat,
  keyInto,
  outlinePoints,
  pathKeyTimes,
  POINT_COORDS,
  pointPath,
  pointsAt,
  shapeAt,
  shapeKeyTimes,
} from "./logic/keys";

const invalid = (message: string) => new CommandFailure("mask.invalid", message);

/** Replaces a path mask's points; on an animated path, changed points are keyed at `at`. */
export const setPoints = defineCommand({
  id: "mask.setPoints",
  label: "Edit mask points",
  description:
    'Sets the points of a path mask, in order (3 or more { id?, x, y, inX, inY, outX, outY }, relative to the mask\'s x/y as mask_list gives them, handles as offsets). Listed ids keep their point, a point without an id is new, unlisted points go with their keys. When the points have keys, "at" (timeline microseconds) keys the six coordinates of every changed point there; without it a changed keyed coordinate fails with mask.animated. "insertAt" { after, t } marks the one new point as inserted on the segment after point "after" at t (0-1): on an animated path it gets keys at every key time of the path, placed on that time\'s curve, and its neighbors\' handles are keyed to keep each shape. Fails with mask.clip_not_found, mask.not_found, mask.invalid and mask.animated. Returns { pointIds }.',
  undoable: true,
  input: z.object({
    clipId: z.string(),
    maskId: z.string(),
    points: z.array(maskPoint.extend({ id: z.string().optional() })).min(3),
    insertAt: z.object({ after: z.string(), t: z.number().min(0).max(1) }).optional(),
    at: z.number().int().min(0).optional(),
  }),
  run(ctx, { clipId, maskId, points, insertAt, at }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const clip = requirePictureClip(ctx, state, clipId);
    const shape = requireMask(clip, maskId).shape;
    if (shape.kind !== "path") throw invalid(`Mask "${maskId}" is not a path.`);
    const listed = points.flatMap((p) => (p.id === undefined ? [] : [p.id]));
    if (new Set(listed).size !== listed.length || listed.some((id) => !Object.hasOwn(shape.points, id))) {
      throw invalid("Each id must be a point of the mask, listed once.");
    }
    const order: PointId[] = points.map((p) => p.id ?? createId("point"));
    const next: Record<PointId, PathPoint> = Object.fromEntries(
      points.map(({ x, y, inX = 0, inY = 0, outX = 0, outY = 0 }, i) => [
        order[i]!,
        { x, y, inX, inY, outX, outY },
      ]),
    );
    const prefix = `masks.${maskId}.shape.points.`;
    const animated = Object.keys(clip.animation ?? {}).some((p) => p.startsWith(prefix));
    const tolerance = Math.floor(frameDuration(formatOf(state, clip)) / 2);
    const t = at === undefined ? undefined : contentTime(clip, clampToClip(clip, at));
    const animation: Record<string, KeyTrack> = { ...clip.animation };
    const exempt = new Set<string>();

    if (insertAt) {
      const fresh = order.filter((_, i) => points[i]!.id === undefined);
      const after = order.indexOf(insertAt.after);
      if (fresh.length !== 1 || after < 0 || order[(after + 1) % order.length] !== fresh[0]) {
        throw invalid('"insertAt" needs exactly one new point, listed right after "after".');
      }
      const added = fresh[0]!;
      const kept = order.filter((id) => id !== added);
      const i = kept.indexOf(insertAt.after);
      const nextId = kept[(i + 1) % kept.length]!;
      if (animated) {
        // The new point and its neighbors' facing handles are keyed here, at every key time.
        const keys = [
          ...POINT_COORDS.map((c) => [added, c, 1] as const),
          [insertAt.after, "outX", 0] as const,
          [insertAt.after, "outY", 0] as const,
          [nextId, "inX", 2] as const,
          [nextId, "inY", 2] as const,
        ];
        // Exact times: a tolerance would merge keys 1 µs apart (the edges keyframe.writeSpan leaves).
        for (const time of pathKeyTimes(clip, maskId)) {
          const split = insertPoint(pointsAt(clip, maskId, kept, time), i, insertAt.t);
          for (const [pid, c, offset] of keys) {
            const point = split[(i + offset) % split.length]!;
            keyInto(animation, pointPath(maskId, pid, c), time, point[c], 0);
          }
        }
        for (const [pid, c] of keys) exempt.add(`${pid}.${c}`);
      }
    }

    if (animated) {
      for (const pid of order) {
        const stored = Object.hasOwn(shape.points, pid) ? shape.points[pid] : undefined;
        const reference = t === undefined || !stored ? stored : pointsAt(clip, maskId, [pid], t)[0];
        const changed = POINT_COORDS.filter(
          (c) => !exempt.has(`${pid}.${c}`) && next[pid]![c] !== reference?.[c],
        );
        if (changed.length === 0) continue;
        if (t === undefined) {
          const keyed = changed.find((c) => animation[pointPath(maskId, pid, c)]);
          if (keyed) {
            throw new CommandFailure(
              "mask.animated",
              `"${pointPath(maskId, pid, keyed)}" is animated: pass "at" (a timeline time) to key it.`,
            );
          }
          continue;
        }
        for (const c of POINT_COORDS) {
          keyInto(animation, pointPath(maskId, pid, c), t, next[pid]![c], tolerance);
        }
      }
    }

    const gone = Object.keys(shape.points).filter((pid) => !Object.hasOwn(next, pid));
    const tracks = withoutTracks(animation, (path) =>
      gone.some((pid) => path.startsWith(`${prefix}${pid}.`)),
    );
    ctx.mutate(store, (draft) => {
      const target = draft.clips[clipId]!;
      target.masks![maskId]!.shape = { ...shape, points: next, pointOrder: order };
      if (tracks) target.animation = tracks;
      else delete target.animation;
    });
    return { pointIds: order };
  },
});

/** Turns a preset mask into a path of points with the same outline, keys included. */
export const convertMask = defineCommand({
  id: "mask.convert",
  label: "Convert mask to points",
  description:
    "Turns a rectangle, ellipse, star or heart mask into a path with the same outline (points relative to the mask's x/y, scale 1; position and rotation stay on the mask). If its shape numbers had keys, the points get keys at the union of their times, each the outline at that time, and the shape keys go. Fails with mask.clip_not_found, mask.not_found and mask.invalid (linear, mirror, already a path, or a star whose point count changes over time). Returns { pointIds }.",
  undoable: true,
  input: z.object({ clipId: z.string(), maskId: z.string() }),
  run(ctx, { clipId, maskId }) {
    const { store } = ctx.require(projectRef);
    const clip = requirePictureClip(ctx, store.getState(), clipId);
    const mask = requireMask(clip, maskId);
    if (mask.shape.kind === "path") throw invalid(`Mask "${maskId}" is already a path.`);
    const times = shapeKeyTimes(clip, maskId);
    const outlines = [mask.shape, ...times.map((t) => shapeAt(clip, mask, t))].map((s) =>
      outlinePoints(mask, s),
    );
    const first = outlines[0];
    if (!first) throw invalid(`A ${mask.shape.kind} mask can't become points.`);
    if (outlines.some((o) => o?.length !== first.length)) {
      throw invalid("The star's number of points changes over time.");
    }
    const [still, ...keyed] = dropFlat(outlines as PathPoint[][]);
    const ids = still!.map(() => createId("point"));
    const prefix = `masks.${maskId}.shape.`;
    const animation = withoutTracks(clip.animation, (path) => path.startsWith(prefix)) ?? {};
    times.forEach((time, k) =>
      ids.forEach((pid, j) => {
        for (const c of POINT_COORDS) {
          keyInto(animation, pointPath(maskId, pid, c), time, keyed[k]![j]![c], 0);
        }
      }),
    );
    ctx.mutate(store, (draft) => {
      const target = draft.clips[clipId]!;
      target.masks![maskId]!.shape = {
        kind: "path",
        scale: 1,
        points: Object.fromEntries(ids.map((id, j) => [id, still![j]!])),
        pointOrder: ids,
      };
      if (Object.keys(animation).length > 0) target.animation = animation;
      else delete target.animation;
    });
    return { pointIds: ids };
  },
});
