import { defineModuleRef } from "@/core";
import type { SoundApi } from "./sound.types";

/** Handle of the sound module: pass it to `require` / `useModule`. */
export const soundRef = defineModuleRef<SoundApi>("sound");
