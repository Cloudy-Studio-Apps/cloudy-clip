import { LOCAL_ACTOR, type Keybinding } from "@/core";
import type { PreviewApi } from "@/modules/preview";
import { compositionMarkers, type ProjectApi } from "@/modules/project";
import { seek } from "@/modules/preview";
import type { StoreApi } from "zustand/vanilla";
import { addMarker } from "./marker.commands";
import { nextMarkerTime, previousMarkerTime } from "./logic/markers";
import type { MarkerUiState } from "./marker.types";

/** M adds a marker at the playhead; Shift+M and Ctrl+Shift+M jump to the next and previous one. */
export function markerKeys(
  project: ProjectApi,
  preview: PreviewApi,
  ui: StoreApi<MarkerUiState>,
): Keybinding[] {
  const jump = (pick: typeof nextMarkerTime) => () => {
    const id = project.view.openFor(LOCAL_ACTOR);
    if (!id) return null;
    const time = pick(compositionMarkers(project.store.getState(), id), preview.playback.getTime());
    return time === null ? null : { command: seek.id, input: { time } };
  };
  return [
    {
      id: "marker.add",
      key: "m",
      resolve: () => ({ command: addMarker.id, input: { color: ui.getState().lastColor } }),
    },
    { id: "marker.next", key: "m", shift: true, resolve: jump(nextMarkerTime) },
    { id: "marker.previous", key: "m", mod: true, shift: true, resolve: jump(previousMarkerTime) },
  ];
}
