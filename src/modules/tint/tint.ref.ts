import { defineModuleRef } from "@/core";
import type { TintApi } from "./tint.types";

/** Handle of the tint module: pass it to `require` / `useModule`. */
export const tintRef = defineModuleRef<TintApi>("tint");
