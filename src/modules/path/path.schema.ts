import { z } from "zod";

const coordinate = z.number().finite();

/** A path's points, as commands take them: two or more, handles as offsets from the point. */
export const pathPoints = z
  .array(
    z.object({
      x: coordinate,
      y: coordinate,
      inX: coordinate.default(0),
      inY: coordinate.default(0),
      outX: coordinate.default(0),
      outY: coordinate.default(0),
    }),
  )
  .min(2, "A path needs at least two points.");
