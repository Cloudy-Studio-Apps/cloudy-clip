import { defineModuleRef } from "@/core";
import type { InspectorApi } from "./inspector.types";

/** Handle of the inspector module: pass it to `require` / `useModule`. */
export const inspectorRef = defineModuleRef<InspectorApi>("inspector");
