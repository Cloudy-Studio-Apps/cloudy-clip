import { defineModuleRef } from "@/core";
import type { MarkerApi } from "./marker.types";

/** Handle of the marker module: pass it to `require` / `useModule`. */
export const markerRef = defineModuleRef<MarkerApi>("marker");
