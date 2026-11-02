import { defineModuleRef } from "@/core";
import type { AudioApi } from "./audio.types";

/** Handle of the audio module: pass it to `require` / `useModule`. */
export const audioRef = defineModuleRef<AudioApi>("audio");
