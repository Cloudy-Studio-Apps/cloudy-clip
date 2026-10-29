import { defineModule } from "@/core";
import { createFontsLibrary } from "./fonts.library";
import { fontsMcpTools } from "./fonts.mcp";
import { fontsRef } from "./fonts.ref";
import { createFontService } from "./fonts.service";
import { createFontsState } from "./fonts.store";

/** Font families (bundled, installed, Google) and loading their faces for drawing. */
export const fontsModule = defineModule({
  ref: fontsRef,
  name: "Fonts",
  tier: "core",
  requires: [],
  mcpTools: fontsMcpTools,
  setup() {
    return { api: createFontsLibrary(createFontService(), createFontsState()) };
  },
});
