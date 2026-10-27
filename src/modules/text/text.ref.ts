import { defineModuleRef } from "@/core";
import type { TextApi } from "./text.types";

/** Handle of the text module: pass it to `require` / `useModule`. */
export const textRef = defineModuleRef<TextApi>("text");
