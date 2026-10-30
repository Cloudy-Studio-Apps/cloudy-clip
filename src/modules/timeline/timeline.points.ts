import { definePoint } from "@/core";
import type { TimelineMenuItems, TimelineOverlay, TimelineTabs } from "./timeline.types";

/** Layers over the lanes (collaborators' playheads). The timeline panel reads them. */
export const timelineOverlays = definePoint<TimelineOverlay>("timeline.overlays", {
  keyOf: (overlay) => overlay.id,
});

/** What sits between the toolbar and the ruler (the composition tabs). The timeline panel reads it. */
export const timelineTabs = definePoint<TimelineTabs>("timeline.tabs", {
  keyOf: (tabs) => tabs.id,
});

/** Entries of the timeline's right-click menu. The timeline panel reads them. */
export const timelineMenuItems = definePoint<TimelineMenuItems>("timeline.menuItems", {
  keyOf: (entry) => entry.id,
});
