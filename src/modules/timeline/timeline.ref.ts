import { defineModuleRef } from "@/core";
import type { TimelineApi } from "./timeline.types";

/** Handle of the timeline module: pass it to `require` / `useModule`. */
export const timelineRef = defineModuleRef<TimelineApi>("timeline");
