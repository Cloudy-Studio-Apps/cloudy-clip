import { defineModuleRef } from "@/core";
import type { CompositionApi } from "./composition.types";

/** Handle of the composition module: pass it to `require` / `useModule`. */
export const compositionRef = defineModuleRef<CompositionApi>("composition");
