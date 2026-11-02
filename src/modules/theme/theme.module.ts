import { defineModule } from "@/core";
import { settingsSections } from "@/modules/settings";
import { BUILT_IN_THEMES } from "./presets";
import { themeCommands } from "./theme.commands";
import { themes } from "./theme.points";
import { themeRef } from "./theme.ref";
import { createThemeService } from "./theme.service";
import { createThemeChoice } from "./theme.store";
import { AppearanceSection } from "./ui";

/** Themes: the `themes` point, the user's choice, and keeping the page in that theme. */
export const themeModule = defineModule({
  ref: themeRef,
  name: "Themes",
  tier: "feature",
  requires: ["settings"],
  commands: themeCommands,
  setup({ contribute, log, onDispose, points }) {
    contribute(themes, ...BUILT_IN_THEMES);
    const { api, dispose } = createThemeService({ points, store: createThemeChoice(), log });
    onDispose(dispose);
    contribute(settingsSections, {
      id: "theme.appearance",
      label: "Appearance",
      component: AppearanceSection,
    });
    return { api };
  },
});
