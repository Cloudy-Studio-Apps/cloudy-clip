import { defineModule } from "@/core";
import { createFontsLibrary } from "./fonts.library";
import { fontsRef } from "./fonts.ref";
import type { FontFamily } from "./fonts.types";

/**
 * For tests: a fonts module with no native calls or network. It uses the real `fontsRef`.
 * `families` are the Google families offered; faces named in `fail` (family names) never load.
 */
export function createFakeFontsModule(options: { families?: FontFamily[]; fail?: string[] } = {}) {
  const { families = [], fail = [] } = options;
  return defineModule({
    ref: fontsRef,
    name: "Fonts (fake)",
    tier: "core",
    requires: [],
    setup() {
      const loadable = async (family: string) => !fail.includes(family);
      return {
        api: createFontsLibrary({
          installed: async () => [],
          googleCatalog: async () => families,
          loadGoogleFace: (r) => loadable(r.family),
          loadByName: (r) => loadable(r.family),
        }),
      };
    },
  });
}
