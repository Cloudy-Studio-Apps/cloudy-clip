import { defineModuleRef } from "@/core";
import type { ThemeApi } from "./theme.types";

/** Handle of the theme module: pass it to `require` / `useModule`. */
export const themeRef = defineModuleRef<ThemeApi>("theme");
