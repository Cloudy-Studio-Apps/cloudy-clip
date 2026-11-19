import { defineModuleRef } from "@/core";
import type { MaskApi } from "./mask.types";

/** Handle of the mask module: pass it to `require` / `useModule`. */
export const maskRef = defineModuleRef<MaskApi>("mask");
