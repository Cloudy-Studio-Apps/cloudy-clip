import { defineModuleRef } from "@/core";
import type { ExportApi } from "./export.types";

/** Handle of the export module: pass it to `require` / `useModule`. */
export const exportRef = defineModuleRef<ExportApi>("export");
