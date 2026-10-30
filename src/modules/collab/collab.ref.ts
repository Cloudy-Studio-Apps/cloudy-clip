import { defineModuleRef } from "@/core";
import type { CollabApi } from "./collab.types";

/** Handle of the collab module: pass it to `require` / `useModule`. */
export const collabRef = defineModuleRef<CollabApi>("collab");
