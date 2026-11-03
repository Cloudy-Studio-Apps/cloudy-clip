import { z } from "zod";
import type { SoundEffect, SoundEffectKind } from "../project.types";
import { eqSchema } from "./sound.schema";

const ATTACK_MS = { min: 0.01, max: 2000 } as const;
const RELEASE_MS = { min: 0.01, max: 9000 } as const;

/**
 * The bounds of every effect value, by kind and field: the schemas below and the controls that set
 * them read these, so they can't disagree.
 */
export const EFFECT_RANGES = {
  compressor: {
    thresholdDb: { min: -60, max: 0 },
    ratio: { min: 1, max: 20 },
    attackMs: ATTACK_MS,
    releaseMs: RELEASE_MS,
    kneeDb: { min: 0, max: 18 },
    makeupDb: { min: 0, max: 36 },
  },
  gate: {
    thresholdDb: { min: -80, max: 0 },
    ratio: { min: 1, max: 20 },
    attackMs: ATTACK_MS,
    releaseMs: RELEASE_MS,
  },
  deesser: { frequencyHz: { min: 2000, max: 12000 }, amount: { min: 0, max: 1 } },
  limiter: { ceilingDb: { min: -20, max: 0 }, releaseMs: { min: 1, max: 8000 } },
  denoise: { amountDb: { min: 0, max: 40 }, floorDb: { min: -80, max: -20 } },
  duck: { depthDb: { min: -40, max: 0 }, attackMs: ATTACK_MS, releaseMs: RELEASE_MS },
} as const;

/** A number within a range of `EFFECT_RANGES`. */
const within = ({ min, max }: { min: number; max: number }) => z.number().min(min).max(max);
const R = EFFECT_RANGES;

/** A compressor's settings; the ratio is at least 1 (below that it would expand). */
export const compressorParamsSchema = z
  .object({
    thresholdDb: within(R.compressor.thresholdDb),
    ratio: within(R.compressor.ratio),
    attackMs: within(R.compressor.attackMs),
    releaseMs: within(R.compressor.releaseMs),
    kneeDb: within(R.compressor.kneeDb),
    makeupDb: within(R.compressor.makeupDb),
  })
  .strict();

const base = { id: z.string(), on: z.boolean() };

/** The schema of each kind of effect, whole (id and `on` included). One per kind; `kind` tells them apart. */
export const effectSchemas = {
  eq: z.object({ ...base, kind: z.literal("eq"), bands: eqSchema.shape.bands }).strict(),
  compressor: z
    .object({
      ...base,
      kind: z.literal("compressor"),
      params: compressorParamsSchema,
    })
    .strict(),
  gate: z
    .object({
      ...base,
      kind: z.literal("gate"),
      thresholdDb: within(R.gate.thresholdDb),
      ratio: within(R.gate.ratio),
      attackMs: within(R.gate.attackMs),
      releaseMs: within(R.gate.releaseMs),
    })
    .strict(),
  deesser: z
    .object({
      ...base,
      kind: z.literal("deesser"),
      frequencyHz: within(R.deesser.frequencyHz),
      amount: within(R.deesser.amount),
    })
    .strict(),
  limiter: z
    .object({
      ...base,
      kind: z.literal("limiter"),
      ceilingDb: within(R.limiter.ceilingDb),
      releaseMs: within(R.limiter.releaseMs),
    })
    .strict(),
  denoise: z
    .object({
      ...base,
      kind: z.literal("denoise"),
      amountDb: within(R.denoise.amountDb),
      floorDb: within(R.denoise.floorDb),
    })
    .strict(),
  duck: z
    .object({
      ...base,
      kind: z.literal("duck"),
      listensTo: z
        .array(z.string())
        .refine((ids) => new Set(ids).size === ids.length, "a track is listed once"),
      depthDb: within(R.duck.depthDb),
      attackMs: within(R.duck.attackMs),
      releaseMs: within(R.duck.releaseMs),
    })
    .strict(),
} satisfies Record<SoundEffectKind, z.ZodType<SoundEffect>>;

/** Every kind of effect, in the order the UI lists them. */
export const SOUND_EFFECT_KINDS = [
  "eq",
  "compressor",
  "gate",
  "deesser",
  "limiter",
  "denoise",
  "duck",
] as const satisfies readonly SoundEffectKind[];

/** Any effect, told apart by `kind`. */
export const soundEffectSchema = z.discriminatedUnion("kind", [
  effectSchemas.eq,
  effectSchemas.compressor,
  effectSchemas.gate,
  effectSchemas.deesser,
  effectSchemas.limiter,
  effectSchemas.denoise,
  effectSchemas.duck,
]);
