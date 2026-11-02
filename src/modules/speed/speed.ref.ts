import { defineModuleRef } from "@/core";
import type { SpeedApi } from "./speed.types";

/** Handle of the speed module: pass it to `require` / `useModule`. */
export const speedRef = defineModuleRef<SpeedApi>("speed");
