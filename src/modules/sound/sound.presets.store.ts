import { z } from "zod";
import { createSavedStore } from "@/core";
import { effectSchemas } from "@/modules/project";
import type { UserPresets } from "./sound.types";

const PRESETS_KEY = "cloudy-clip.sound-presets";

/** An effect as a preset holds it: the kind's own schema without the id. */
const effectSpec = z.discriminatedUnion("kind", [
  effectSchemas.eq.omit({ id: true }),
  effectSchemas.compressor.omit({ id: true }),
  effectSchemas.gate.omit({ id: true }),
  effectSchemas.deesser.omit({ id: true }),
  effectSchemas.limiter.omit({ id: true }),
  effectSchemas.denoise.omit({ id: true }),
  effectSchemas.duck.omit({ id: true }),
]);

const preset = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  effects: z.array(effectSpec),
});

/**
 * The stored list, each preset parsed on its own: one that no longer parses (an older or edited
 * entry) is dropped, never the whole list, so the next save can't wipe the others.
 */
const saved = z.object({
  presets: z.array(z.unknown()).transform((entries) =>
    entries.flatMap((entry) => {
      const parsed = preset.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
});

/**
 * Creates the user's own presets of one kernel, read from `localStorage` and saved on each change.
 * None until the user saves one; a stored list that doesn't parse is dropped.
 */
export function createUserPresets() {
  return createSavedStore<UserPresets>(PRESETS_KEY, saved, { presets: [] });
}
