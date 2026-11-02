import { defineModuleRef } from "@/core";
import type { MediaApi } from "./media.types";

/** Handle of the media module: pass it to `require` / `useModule`. */
export const mediaRef = defineModuleRef<MediaApi>("media");

/** Id of the Media page. */
export const MEDIA_PAGE = "media.page";
