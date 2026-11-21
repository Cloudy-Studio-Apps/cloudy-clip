import { z } from "zod";
import { MARKER_COLORS } from "@/modules/project";

const finite = z.number().finite();

/** The most points a path mask takes from input. */
export const MAX_POINTS = 2000;

/** A point of a path mask: handles default to 0 (a corner). */
export const maskPoint = z.object({
  x: finite,
  y: finite,
  inX: finite.optional(),
  inY: finite.optional(),
  outX: finite.optional(),
  outY: finite.optional(),
});

/** How a mask combines with the ones before it. */
export const maskMode = z.enum(["add", "subtract", "intersect", "difference"]);

/** The numbers of a mask that `mask.add` takes. Ranges are checked by `checkRange`. */
export const maskNumbers = z
  .object({
    opacity: finite,
    feather: finite,
    expansion: finite,
    x: finite,
    y: finite,
    rotation: finite,
    width: finite,
    height: finite,
    roundness: finite,
    points: finite,
    inner: finite,
  })
  .partial()
  .strict();

/** The numbers of a shape that `mask.update` can change. */
export const shapeNumbers = maskNumbers
  .pick({ width: true, height: true, roundness: true, points: true, inner: true })
  .extend({ scale: finite })
  .partial()
  .strict();

/** What `mask.update` can change besides the shape: everything but `id` and the points. */
export const maskPatch = z
  .object({
    name: z.string().trim().min(1),
    color: z.enum(MARKER_COLORS),
    on: z.boolean(),
    invert: z.boolean(),
    mode: maskMode,
    opacity: finite,
    feather: finite,
    expansion: finite,
    x: finite,
    y: finite,
    rotation: finite,
    shape: shapeNumbers,
  })
  .partial()
  .strict();
