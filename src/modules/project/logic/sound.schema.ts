import { z } from "zod";

/** The lowest volume in decibels a clip, a track or the master can have. */
export const VOLUME_DB_MIN = -60;
/** The highest volume in decibels a clip, a track or the master can have. */
export const VOLUME_DB_MAX = 12;

/** A volume in decibels: `VOLUME_DB_MIN` to `VOLUME_DB_MAX` (-60 to 12). */
export const volumeDbSchema = z.number().min(VOLUME_DB_MIN).max(VOLUME_DB_MAX);

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
