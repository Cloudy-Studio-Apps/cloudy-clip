import { defineModule } from "@/core";
import { BUILT_IN_THEMES } from "./presets";
import { themeCommands } from "./theme.commands";
import { themes } from "./theme.points";
import { themeRef } from "./theme.ref";
import { createThemeService } from "./theme.service";
import { createThemeChoice } from "./theme.store";

/** Themes: the `themes` point, the user's choice, and keeping the page in that theme. */
export const themeModule = defineModule({
  ref: themeRef,
  name: "Themes",
  tier: "feature",
  commands: themeCommands,
  setup({ contribute, log, onDispose, points }) {
    contribute(themes, ...BUILT_IN_THEMES);
    const { api, dispose } = createThemeService({ points, store: createThemeChoice(), log });
    onDispose(dispose);
    return { api };
  },
});
