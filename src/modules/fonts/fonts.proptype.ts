import { z } from "zod";
import { definePropType } from "@/modules/element";
import type { FontSource } from "./fonts.types";

/**
 * The `font` prop type: `{ family, source }` with a source from the property's `sources`. Edited
 * by the `font-picker` control (contributed by the text module).
 */
export const fontPropType = definePropType({
  name: "font",
  control: "font-picker",
  schema(args) {
    const { sources } = args as { sources: readonly FontSource[] };
    return z
      .strictObject({
        family: z.string().min(1),
        source: z.enum(sources as [FontSource, ...FontSource[]]),
      })
      .describe("Family name and source; list the choices with fonts_list");
  },
});
