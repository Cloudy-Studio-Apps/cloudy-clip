import { z } from "zod";

/** A volume in decibels: -60 to 12. */
export const volumeDbSchema = z.number().min(-60).max(12);

/** A pan: -1 (left) to 1 (right). */
export const panSchema = z.number().min(-1).max(1);

/** One band of an equalizer. */
export const eqBandSchema = z.object({
  on: z.boolean(),
  shape: z.enum(["bell", "lowShelf", "highShelf", "lowCut", "highCut"]),
  hz: z.number().min(20).max(20000),
  db: z.number().min(-24).max(24),
  q: z.number().min(0.1).max(10),
});

/** An equalizer: on or off, and always six bands. */
export const eqSchema = z.object({ on: z.boolean(), bands: z.array(eqBandSchema).length(6) });
