import type { Micros } from "@/core";
import type { Marker } from "@/modules/project";

/** The first marker time after `time`, or null. `markers` are sorted by time. */
export function nextMarkerTime(markers: readonly Marker[], time: Micros): Micros | null {
  return markers.find((marker) => marker.time > time)?.time ?? null;
}

/** The last marker time before `time`, or null. `markers` are sorted by time. */
export function previousMarkerTime(markers: readonly Marker[], time: Micros): Micros | null {
  let found: Micros | null = null;
  for (const marker of markers) {
    if (marker.time >= time) break;
    found = marker.time;
  }
  return found;
}

/** The start of the frame `time` falls in. */
export function floorToFrame(time: Micros, frame: Micros): Micros {
  return Math.floor(time / frame) * frame;
}
