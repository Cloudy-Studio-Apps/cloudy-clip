import { createContext, useContext } from "react";
import type { TimelineScopeName } from "@/core";

const ScopeContext = createContext<TimelineScopeName>("all");

/** Provided by `TimelinePanel`: everything inside it reads the panel's scope with `useTimelineScope`. */
export const TimelineScopeProvider = ScopeContext.Provider;

/** The scope of the timeline panel this component sits in (`"all"` outside one). */
export function useTimelineScope(): TimelineScopeName {
  return useContext(ScopeContext);
}
