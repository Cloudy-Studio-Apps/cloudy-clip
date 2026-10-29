import { defineModuleRef } from "@/core";
import type { ElementApi } from "./element.types";

/** Handle of the element module: pass it to `require` / `useModule`. */
export const elementRef = defineModuleRef<ElementApi>("element");
