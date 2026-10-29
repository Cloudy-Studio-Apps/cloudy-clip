import { defineModuleRef } from "@/core";
import type { FontsApi } from "./fonts.types";

/** Handle of the fonts module: pass it to `require` / `useModule`. */
export const fontsRef = defineModuleRef<FontsApi>("fonts");
