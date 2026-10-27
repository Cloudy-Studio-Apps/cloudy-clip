import { defineModuleRef } from "@/core";
import type { ProjectApi } from "./project.types";

/** Handle of the project module: pass it to `require` / `useModule`. */
export const projectRef = defineModuleRef<ProjectApi>("project");
