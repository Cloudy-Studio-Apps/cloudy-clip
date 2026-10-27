import { defineModuleRef } from "@/core";
import type { PreviewApi } from "./preview.types";

/** Handle of the preview module: pass it to `require` / `useModule`. */
export const previewRef = defineModuleRef<PreviewApi>("preview");
