import { z } from "zod";
import { BLEND_MODES } from "../project.types";
import type { ClipGrade, CorrectionValues, InputColorSpace } from "../project.types";

const pair = z.tuple([z.number(), z.number()]);
const pos = z.object({ x: z.number(), y: z.number() }).optional();

/** A picture in the graph: the source's, or a node's. */
export const nodeRefSchema = z.object({
  node: z.string().min(1),
  channel: z.enum(["r", "g", "b"]).optional(),
});

/** What a correction touches. */
export const gradeLimitSchema = z.object({
  color: z
    .object({ on: z.boolean(), hue: pair, sat: pair, lum: pair, soft: z.number() })
    .optional(),
  brightness: z.object({ on: z.boolean(), range: pair, soft: z.number() }).optional(),
  refine: z.object({ soft: z.number(), clean: z.number() }).optional(),
  invert: z.literal(true).optional(),
  from: z.string().min(1).optional(),
});

/** A correction's values: an object; each field's bounds are checked by `validateGrade` (`GRADE_RANGES`). */
export const correctionValuesSchema = z.custom<Partial<CorrectionValues>>(
  (value) => typeof value === "object" && value !== null && !Array.isArray(value),
  "values must be an object",
);

const base = { on: z.boolean(), opacity: z.number().min(0).max(1), pos };

/** One node of a grade. */
export const gradeNodeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("correct"),
    input: nodeRefSchema,
    ...base,
    name: z.string().optional(),
    values: correctionValuesSchema.optional(),
    limit: gradeLimitSchema.optional(),
    lut: z.object({ id: z.string().min(1), strength: z.number().min(0).max(1) }).optional(),
  }),
  z.object({ kind: z.literal("parallel"), inputs: z.array(nodeRefSchema), ...base }),
  z.object({
    kind: z.literal("layer"),
    inputs: z.array(nodeRefSchema),
    blends: z.array(z.enum(BLEND_MODES)),
    ...base,
  }),
  z.object({ kind: z.literal("split"), input: nodeRefSchema, pos }),
  z.object({
    kind: z.literal("join"),
    r: nodeRefSchema,
    g: nodeRefSchema,
    b: nodeRefSchema,
    pos,
  }),
  z.object({
    kind: z.literal("keyJoin"),
    keys: z.array(
      z.object({ from: z.string().min(1), mode: z.enum(["add", "subtract", "intersect"]) }),
    ),
    pos,
  }),
]);

/** Every camera color space a grade's `input` can be; `"rec709"` (the default) converts nothing. */
export const INPUT_SPACES = [
  "rec709",
  "srgb",
  "slog3",
  "appleLog",
  "clog2",
  "clog3",
  "vlog",
  "flog",
] as const satisfies readonly InputColorSpace[];

/** A whole grade. Its graph rules (refs, cycles, ranges) are `validateGrade`'s. */
export const gradeSchema = z.object({
  input: z.enum(INPUT_SPACES).optional(),
  nodes: z.record(z.string(), gradeNodeSchema),
  out: nodeRefSchema,
}) as unknown as z.ZodType<ClipGrade>;
