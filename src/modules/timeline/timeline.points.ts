import { definePoint } from "@/core";
import type { TimelineOverlay } from "./timeline.types";

/** Layers over the lanes (collaborators' playheads). The timeline panel reads them. */
export const timelineOverlays = definePoint<TimelineOverlay>("timeline.overlays", {
  keyOf: (overlay) => overlay.id,
});
