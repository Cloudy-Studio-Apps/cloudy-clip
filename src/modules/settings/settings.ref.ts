import { defineModuleRef } from "@/core";
import type { SettingsApi } from "./settings.types";

/** Handle of the settings module: pass it to `require` / `useModule`. */
export const settingsRef = defineModuleRef<SettingsApi>("settings");
