import { defineModuleRef } from "@/core";
import type { WorkspaceApi } from "./workspace.types";

/** Handle of the workspace module: pass it to `require` / `useModule`. */
export const workspaceRef = defineModuleRef<WorkspaceApi>("workspace");
