import { z } from "zod";

/**
 * A `#rrggbb` colour, as any command takes one. The pattern lists both cases itself, so the JSON
 * schema an agent reads accepts what the server does; the value is stored lowercase.
 */
export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "A colour is #rrggbb.")
  .transform((value) => value.toLowerCase());
