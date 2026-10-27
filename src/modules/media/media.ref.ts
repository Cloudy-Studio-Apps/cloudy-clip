import { defineModuleRef } from "@/core";
import type { MediaApi } from "./media.types";

/** Handle of the media module: pass it to `require` / `useModule`. */
export const mediaRef = defineModuleRef<MediaApi>("media");
