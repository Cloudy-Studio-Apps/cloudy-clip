import { defineModuleRef } from "@/core";
import type { PathApi } from "./path.types";

/** Handle of the path module: pass it to `require` / `useModule`. */
export const pathRef = defineModuleRef<PathApi>("path");
