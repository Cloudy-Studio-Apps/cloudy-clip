import type { KeyField, KeyTarget } from "@/modules/keyframe";
import { MASK_RANGES, orderedMasks, projectRef, type ClipMask } from "@/modules/project";
import { updateMask } from "./mask.commands";
import { setPoints } from "./mask.points.commands";
import { POINT_COORDS, pointPath } from "./logic/keys";

const MASK_FIELDS = ["opacity", "feather", "expansion", "x", "y", "rotation"] as const;
const SHAPE_FIELDS = ["width", "height", "roundness", "points", "inner", "scale"] as const;
const LABELS: Record<string, string> = { x: "X", y: "Y", inX: "In X", inY: "In Y" };
const label = (name: string) =>
  LABELS[name] ??
  (name.startsWith("out") ? `Out ${name.slice(3)}` : name[0]!.toUpperCase() + name.slice(1));

/**
 * Every keyable number of a picture clip's masks: `masks.<id>.opacity | feather | expansion | x | y |
 * rotation`, the shape's numbers (`masks.<id>.shape.width | height | roundness | points | inner |
 * scale`, by kind) and each path point's coordinates (`masks.<id>.shape.points.<pid>.x | y | inX |
 * inY | outX | outY`, labeled "Point <n> · X"), one group per mask. When the last key goes,
 * `mask.update` or `mask.setPoints` makes the value static.
 */
export const maskKeys: KeyTarget = {
  id: "mask.keys",
  fields(clip, track) {
    if (track.kind !== "video") return [];
    return orderedMasks(clip).flatMap((mask): KeyField[] => {
      const id = mask.id;
      const group = { prefix: `masks.${id}.`, label: mask.name };
      const base = (
        path: string,
        name: string,
        range: string,
        read: (m: ClipMask) => number | undefined,
      ) => ({
        path,
        label: name,
        group,
        blend: "number" as const,
        shared: true as const,
        ...MASK_RANGES[range],
        read: (at: typeof clip) => {
          const found = at.masks?.[id];
          return (found && read(found)) ?? 0;
        },
      });
      const own = MASK_FIELDS.map((name) => ({
        ...base(`masks.${id}.${name}`, label(name), name, (m) => m[name]),
        commitStatic: (run, clipId, value) =>
          run.execute(updateMask, { clipId, maskId: id, patch: { [name]: Number(value) } }),
      })) satisfies KeyField[];
      const numbers = mask.shape as unknown as Record<string, unknown>;
      const shapeFields = SHAPE_FIELDS.filter((name) => typeof numbers[name] === "number").map(
        (name) => ({
          ...base(
            `masks.${id}.shape.${name}`,
            label(name),
            name,
            (m) => (m.shape as unknown as Record<string, number>)[name],
          ),
          commitStatic: (run, clipId, value) =>
            run.execute(updateMask, {
              clipId,
              maskId: id,
              patch: { shape: { [name]: Number(value) } },
            }),
        }),
      ) satisfies KeyField[];
      const shape = mask.shape;
      const points =
        shape.kind !== "path"
          ? []
          : shape.pointOrder.flatMap((pid, n) =>
              POINT_COORDS.map((c): KeyField => ({
                ...base(pointPath(id, pid, c), `Point ${n + 1} · ${label(c)}`, "", (m) =>
                  m.shape.kind === "path" ? m.shape.points[pid]?.[c] : undefined,
                ),
                commitStatic(run, clipId, value) {
                  const now = run.require(projectRef).store.getState().clips[clipId]?.masks?.[id];
                  if (now?.shape.kind !== "path" || !now.shape.points[pid])
                    return Promise.resolve();
                  const { points: stored, pointOrder } = now.shape;
                  const list = pointOrder.map((p) => ({ id: p, ...stored[p]! }));
                  list[pointOrder.indexOf(pid)]![c] = Number(value);
                  return run.execute(setPoints, { clipId, maskId: id, points: list });
                },
              })),
            );
      return [...own, ...shapeFields, ...points];
    });
  },
};
