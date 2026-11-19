import { CommandFailure, createId } from "@/core";
import {
  MARKER_COLORS,
  type Clip,
  type ClipMask,
  type MaskShape,
  type PathPoint,
  type PointId,
  type ProjectFormat,
} from "@/modules/project";
import { checkRange } from "./mask.guards";
import type { MaskNumbers, MaskPointInput, MaskPreset } from "./mask.types";

const SHAPE_KEYS = ["width", "height", "roundness", "points", "inner"] as const;

/** A preset's shape at its defaults: half the frame, Mirror a quarter of the frame's height. */
function presetShape(preset: MaskPreset, format: ProjectFormat): MaskShape {
  const width = format.width / 2;
  const height = format.height / 2;
  switch (preset) {
    case "rectangle":
      return { kind: "rectangle", width, height, roundness: 0 };
    case "ellipse":
      return { kind: "ellipse", width, height };
    case "star":
      return { kind: "star", width, height, points: 5, inner: 0.5 };
    case "heart":
      return { kind: "heart", width, height };
    case "linear":
      return { kind: "linear" };
    case "mirror":
      return { kind: "mirror", width: format.height / 4 };
  }
}

/** A path shape from points in mask space, stored relative to their bounding box's center. */
function pathShape(input: MaskPointInput[]): { shape: MaskShape; x: number; y: number } {
  const xs = input.map((p) => p.x);
  const ys = input.map((p) => p.y);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2;
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const points: Record<PointId, PathPoint> = {};
  const pointOrder: PointId[] = [];
  for (const p of input) {
    const id = createId("point");
    pointOrder.push(id);
    points[id] = {
      x: p.x - x,
      y: p.y - y,
      inX: p.inX ?? 0,
      inY: p.inY ?? 0,
      outX: p.outX ?? 0,
      outY: p.outY ?? 0,
    };
  }
  return { shape: { kind: "path", scale: 1, points, pointOrder }, x, y };
}

/** The first "Mask N" the clip doesn't have. */
function freeName(clip: Clip): string {
  const taken = new Set(Object.values(clip.masks ?? {}).map((m) => m.name));
  let n = 1;
  while (taken.has(`Mask ${n}`)) n++;
  return `Mask ${n}`;
}

/** A new mask for `clip` with the defaults of the design; throws `mask.invalid` for bad values. */
export function buildMask(
  clip: Clip,
  format: ProjectFormat,
  input: {
    preset?: MaskPreset | undefined;
    points?: MaskPointInput[] | undefined;
    values?: MaskNumbers | undefined;
    mode?: ClipMask["mode"] | undefined;
    name?: string | undefined;
  },
): ClipMask {
  const { preset, points, values = {} } = input;
  if ((preset === undefined) === (points === undefined)) {
    throw new CommandFailure("mask.invalid", 'Give exactly one of "preset" and "points".');
  }
  if (points && points.length < 3) {
    throw new CommandFailure("mask.invalid", "A path mask needs at least 3 points.");
  }
  for (const [name, value] of Object.entries(values)) checkRange(name, value);
  const path = points ? pathShape(points) : undefined;
  let shape = path ? path.shape : presetShape(preset!, format);
  for (const key of SHAPE_KEYS) {
    const value = values[key];
    if (value === undefined) continue;
    if (!(key in shape) || shape.kind === "path") {
      throw new CommandFailure("mask.invalid", `A ${shape.kind} mask has no "${key}".`);
    }
    shape = { ...shape, [key]: value } as MaskShape;
  }
  const count = Object.keys(clip.masks ?? {}).length;
  return {
    id: createId("mask"),
    name: input.name ?? freeName(clip),
    color: MARKER_COLORS[count % MARKER_COLORS.length]!,
    mode: input.mode ?? "add",
    opacity: values.opacity ?? 1,
    feather: values.feather ?? 0,
    expansion: values.expansion ?? 0,
    x: values.x ?? path?.x ?? 0,
    y: values.y ?? path?.y ?? 0,
    rotation: values.rotation ?? 0,
    shape,
  };
}
