import { defineModuleRef } from "@/core";
import type { SolidApi } from "./solid.types";

/** Handle of the solid module: pass it to `require` / `useModule`. */
export const solidRef = defineModuleRef<SolidApi>("solid");
