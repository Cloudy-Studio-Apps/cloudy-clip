import { useCallback } from "react";
import { useModule } from "@/core";
import { tintRef } from "../tint.ref";
import type { TintView } from "../tint.types";

/** Changes the Tint page's view state (which tab, which mode); never the project. */
export function useTintSet(): (patch: Partial<TintView>) => void {
  const tint = useModule(tintRef);
  return useCallback((patch) => tint.view.setState(patch), [tint]);
}
