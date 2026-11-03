import { useStore } from "zustand";
import { useModule } from "@/core";
import { tintRef } from "../tint.ref";
import type { TintView } from "../tint.types";

/** A slice of the Tint page's view state. Select raw values (rule 25). */
export function useTintView<T>(select: (view: TintView) => T): T {
  return useStore(useModule(tintRef).view, select);
}
