import { definePoint } from "@/core";
import type { SettingsSection } from "./settings.types";

/** The sections of the Settings window. */
export const settingsSections = definePoint<SettingsSection>("settings.sections", {
  keyOf: (section) => section.id,
});
