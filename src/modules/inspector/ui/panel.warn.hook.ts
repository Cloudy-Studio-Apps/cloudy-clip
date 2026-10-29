import { useEffect } from "react";
import { useModule } from "@/core";
import { elementRef } from "@/modules/element";

/** Logs a declaration problem once per kernel (after render, not during it). */
export function useWarnOnce(message: string | null): void {
  const elements = useModule(elementRef);
  useEffect(() => {
    if (message) elements.warn(message);
  }, [elements, message]);
}
