import { createContext, useContext } from "react";
import type { MeterLoop } from "../../sound.types";

const MeterLoopContext = createContext<MeterLoop | null>(null);

/** Provided by the mixer: every `Meter` inside registers with its loop. */
export const MeterLoopProvider = MeterLoopContext.Provider;

/** The meter loop of the mixer this component sits in. */
export function useMeters(): MeterLoop | null {
  return useContext(MeterLoopContext);
}
