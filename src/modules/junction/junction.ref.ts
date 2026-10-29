import { defineModuleRef } from "@/core";
import type { JunctionApi } from "./junction.types";

/** Handle of the junction module: pass it to `require` / `useModule`. */
export const junctionRef = defineModuleRef<JunctionApi>("junction");
