import { defineModuleRef } from "@/core";
import type { TintApi } from "./tint.types";

/** Id of the Tint page. */
export const TINT_PAGE = "tint.page";

/** Handle of the tint module: pass it to `require` / `useModule`. */
export const tintRef = defineModuleRef<TintApi>("tint");
