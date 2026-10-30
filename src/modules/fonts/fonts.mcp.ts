import { z } from "zod";
import { defineMcpTool, textResult } from "@/core";
import { fontsRef } from "./fonts.ref";
import { searchFamilies } from "./logic/variants";

/** Lists the font families text can use. */
const listFonts = defineMcpTool({
  name: "fonts_list",
  readOnly: true,
  description:
    'Lists the font families a text clip can use (bundled, installed on this computer, Google Fonts). Optional "query" filters by name; "source" is bundled, installed or google; "limit" defaults to 50 (max 200). Returns family, source, available weights and whether italic exists.',
  input: z.object({
    query: z.string().optional(),
    source: z.enum(["bundled", "installed", "google"]).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async handler(input, ctx) {
    const all = await ctx.require(fontsRef).families();
    const pool = input.source ? all.filter((f) => f.source === input.source) : all;
    return textResult(
      searchFamilies(pool, input.query ?? "", input.limit).map((f) => ({
        family: f.family,
        source: f.source,
        weights: [...new Set(f.variants.map((v) => v.weight))],
        italic: f.variants.some((v) => v.style === "italic"),
      })),
    );
  },
});

/** The MCP tools of the fonts module: `fonts_list`. */
export const fontsMcpTools = [listFonts];
