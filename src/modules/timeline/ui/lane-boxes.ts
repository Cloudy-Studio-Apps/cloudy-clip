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

/** Marks the lane of a track as a drop target (`data-cut-target`), or clears every mark (null). */
export function highlightLane(trackId: string | null): void {
  for (const lane of document.querySelectorAll<HTMLElement>("[data-cut-target]")) {
    if (lane.dataset.trackId !== trackId) delete lane.dataset.cutTarget;
  }
  if (trackId === null) return;
  for (const lane of document.querySelectorAll<HTMLElement>("[data-track-id]")) {
    if (lane.dataset.trackId === trackId) lane.dataset.cutTarget = "";
  }
}
