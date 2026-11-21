import { defineModuleRef } from "@/core";
import type { SubtitleApi } from "./subtitle.types";

/** Handle of the subtitle module: pass it to `require` / `useModule`. */
export const subtitleRef = defineModuleRef<SubtitleApi>("subtitle");
