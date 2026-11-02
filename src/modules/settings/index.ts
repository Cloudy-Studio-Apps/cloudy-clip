/**
 * Settings module: the Settings window, filled by the `settingsSections` point.
 * @module settings
 */
export type { SettingsApi, SettingsSection, SettingsState } from "./settings.types";

/** Opens the Settings window. */
export { openSettings } from "./settings.commands";
/** Module definition, loaded by the app shell. */
export { settingsModule } from "./settings.module";
/** The point sections are contributed to. */
export { settingsSections } from "./settings.points";
/** Handle for `require(settingsRef)` / `useModule(settingsRef)`. */
export { settingsRef } from "./settings.ref";
