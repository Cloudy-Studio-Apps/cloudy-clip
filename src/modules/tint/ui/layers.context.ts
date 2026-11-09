import { createContext, useContext } from "react";
import type { LayersEnv } from "./ui.types";

export const LayersContext = createContext<LayersEnv | null>(null);

/** What the layer rows read; rows only exist inside the layer list. */
export function useLayers(): LayersEnv {
  const env = useContext(LayersContext);
  if (!env) throw new Error("useLayers must be used inside the layer list");
  return env;
}
