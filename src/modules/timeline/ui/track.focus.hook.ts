import { createContext, useContext } from "react";
import type { TrackFocus } from "../timeline.types";

const TrackFocusContext = createContext<TrackFocus | null>(null);

/** Provided by `TimelinePanel` when its page keeps a track in focus. */
export const TrackFocusProvider = TrackFocusContext.Provider;

/** The track focus of the panel this component sits in, or null when its page has none. */
export function useTrackFocus(): TrackFocus | null {
  return useContext(TrackFocusContext);
}
