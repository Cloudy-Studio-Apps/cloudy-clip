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
  setup({ log }) {
    const api = createFontsLibrary(createFontService(), createFontsState(), log);
    // Fill `knownFamilies()` in the background; commands never wait for it.
    api.families().catch((error: unknown) => log.warn("Could not list fonts", error));
    return { api };
  },
});
