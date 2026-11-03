import { appMenuItems, appOverlays, defineModule, keybindings, topBarItems } from "@/core";
import { openSettings, settingsCommands } from "./settings.commands";
import { settingsRef } from "./settings.ref";
import { createSettingsState } from "./settings.store";
import { SettingsButton, SettingsDialog } from "./ui";

/** The Settings window. What it holds comes from the `settingsSections` point. */
export const settingsModule = defineModule({
  ref: settingsRef,
  name: "Settings",
  tier: "feature",
  commands: settingsCommands,
  setup({ contribute }) {
    const store = createSettingsState();
    contribute(appOverlays, { id: "settings.dialog", component: SettingsDialog });
    contribute(topBarItems, { id: "settings.button", slot: "right", component: SettingsButton });
    contribute(keybindings, {
      id: "settings.open",
      key: ",",
      mod: true,
      resolve: () => ({ command: openSettings.id, input: {} }),
    });
    contribute(appMenuItems, {
      id: "settings.open",
      menu: "File",
      label: "Settings",
      order: 90,
      keybinding: "settings.open",
    });
    return { api: { store, close: () => store.setState({ open: false }) } };
  },
});
