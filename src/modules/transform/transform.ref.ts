import { defineModuleRef } from "@/core";
import type { TransformApi } from "./transform.types";

/** Handle of the transform module: pass it to `require` / `useModule`. */
export const transformRef = defineModuleRef<TransformApi>("transform");
