import type { LaneBox } from "../timeline.types";

/** Screen boxes of the timeline lanes currently rendered (each lane's left edge is time 0). */
export function laneBoxes(): LaneBox[] {
  return [...document.querySelectorAll<HTMLElement>("[data-track-id]")].flatMap((lane) => {
    const trackId = lane.dataset.trackId;
    if (!trackId) return [];
    const rect = lane.getBoundingClientRect();
    return [{ trackId, left: rect.left, top: rect.top, bottom: rect.bottom }];
  });
}
