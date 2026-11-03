import { z } from "zod";
import type { SoundEffect, SoundEffectKind } from "../project.types";
import { eqBandSchema } from "./sound.schema";

const ms = z.number().min(0.01).max(9000);
const attack = z.number().min(0.01).max(2000);

/** A compressor's settings; the ratio is at least 1 (below that it would expand). */
export const compressorParamsSchema = z.object({
  thresholdDb: z.number().min(-60).max(0),
  ratio: z.number().min(1).max(20),
  attackMs: attack,
  releaseMs: ms,
  kneeDb: z.number().min(0).max(18),
  makeupDb: z.number().min(0).max(36),
});

const base = { id: z.string(), on: z.boolean() };

/** The schema of each kind of effect, whole (id and `on` included). One per kind; `kind` tells them apart. */
export const effectSchemas = {
  eq: z.object({ ...base, kind: z.literal("eq"), bands: z.array(eqBandSchema).length(6) }),
  compressor: z.object({
    ...base,
    kind: z.literal("compressor"),
    params: compressorParamsSchema,
  }),
  gate: z.object({
    ...base,
    kind: z.literal("gate"),
    thresholdDb: z.number().min(-80).max(0),
    ratio: z.number().min(1).max(20),
    attackMs: attack,
    releaseMs: ms,
  }),
  deesser: z.object({
    ...base,
    kind: z.literal("deesser"),
    frequencyHz: z.number().min(2000).max(12000),
    amount: z.number().min(0).max(1),
  }),
  limiter: z.object({
    ...base,
    kind: z.literal("limiter"),
    ceilingDb: z.number().min(-20).max(0),
    releaseMs: z.number().min(1).max(8000),
  }),
  denoise: z.object({
    ...base,
    kind: z.literal("denoise"),
    amountDb: z.number().min(0).max(40),
    floorDb: z.number().min(-80).max(-20),
  }),
  duck: z.object({
    ...base,
    kind: z.literal("duck"),
    listensTo: z.array(z.string()),
    depthDb: z.number().min(-40).max(0),
    attackMs: attack,
    releaseMs: ms,
  }),
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
