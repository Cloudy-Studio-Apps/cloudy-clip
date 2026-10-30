import { definePoint } from "@/core";
import type {
  ClipActions,
  TimelineDropHandler,
  TimelineMenuItems,
  TimelineOverlay,
  TimelineTabs,
} from "./timeline.types";

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

/** Who gets a drop before the timeline, in order. The timeline's `drop` reads them. */
export const timelineDropHandlers = definePoint<TimelineDropHandler>("timeline.dropHandlers", {
  keyOf: (handler) => handler.id,
});

/** What modules do with a clip: double-click and right-click. Each clip reads them. */
export const clipActions = definePoint<ClipActions>("timeline.clipActions", {
  keyOf: (actions) => actions.id,
});
