import { z } from "zod";
import type { KeyEase } from "../project.types";

const unit = z.number().min(0).max(1);

/** What a key does on the way to the next one. */
export const keyEase = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("linear") }),
  z.object({ kind: z.literal("hold") }),
  z.object({
    kind: z.literal("bezier"),
    x1: unit,
    y1: z.number(),
    x2: unit,
    y2: z.number(),
  }),
  z.object({ kind: z.literal("named"), name: z.enum(["bounce", "elastic"]) }),
]) satisfies z.ZodType<KeyEase>;
