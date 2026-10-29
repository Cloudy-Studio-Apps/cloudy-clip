import { z } from "zod";

const hex = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Use #rrggbb")
  .transform((value) => value.toLowerCase());
const opacity = z.number().min(0).max(1);
const range = (min: number, max: number) => z.number().finite().min(min).max(max);

/** Zod shape of a `TextStylePatch`: every field optional, nested groups partial, ranges checked. */
export const textStylePatch = z.object({
  font: z
    .object({
      family: z.string().min(1),
      source: z.enum(["bundled", "installed", "google"]),
    })
    .optional()
    .describe("Family name and source; list the choices with fonts_list"),
  size: range(1, 2000).optional().describe("Output pixels"),
  weight: z.enum(["100", "200", "300", "400", "500", "600", "700", "800", "900"]).optional(),
  italic: z.boolean().optional(),
  letterSpacing: range(-200, 1000).optional().describe("Output pixels"),
  lineHeight: range(0.5, 4).optional().describe("In font sizes"),
  align: z.enum(["left", "center", "right"]).optional(),
  uppercase: z.boolean().optional(),
  fill: z.object({ color: hex.optional(), opacity: opacity.optional() }).optional(),
  outline: z
    .object({
      enabled: z.boolean().optional(),
      color: hex.optional(),
      width: range(0, 200).optional(),
    })
    .optional(),
  background: z
    .object({
      enabled: z.boolean().optional(),
      color: hex.optional(),
      opacity: opacity.optional(),
      padding: range(0, 500).optional(),
      radius: range(0, 500).optional(),
    })
    .optional(),
  shadow: z
    .object({
      enabled: z.boolean().optional(),
      color: hex.optional(),
      opacity: opacity.optional(),
      blur: range(0, 500).optional(),
      distance: range(0, 500).optional(),
      angle: range(-180, 360).optional().describe("Degrees, 90 = down"),
    })
    .optional(),
});

/** Names of the presets, for command inputs. */
export const textPresetId = z.enum(["title", "highlight", "outline", "pop", "lower-third"]);
