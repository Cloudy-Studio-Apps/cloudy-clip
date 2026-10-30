import { defineModuleRef } from "@/core";
import type { StickerApi } from "./sticker.types";

/** Handle of the sticker module: pass it to `require` / `useModule`. */
export const stickerRef = defineModuleRef<StickerApi>("sticker");
