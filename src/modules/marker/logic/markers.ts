import type { Micros } from "@/core";
import type { Marker, MarkerColor } from "@/modules/project";

/** How each marker color is drawn. Fixed: a marker's color is the user's label, not chrome. */
export const MARKER_HEX: Record<MarkerColor, string> = {
  orange: "#e8772e",
  yellow: "#e3bd2f",
  green: "#6f9a3a",
  blue: "#5f9fd6",
  purple: "#8f7ac8",
  pink: "#d4488f",
};

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
