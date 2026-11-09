import { useCallback } from "react";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import { pxToTime } from "../logic/geometry";
import { snapTime } from "../logic/placement";
import { SNAP_PX } from "../timeline.layout";
import { timelineRef } from "../timeline.ref";
import { useSnapCandidates } from "./snap.hook";

/**
 * Starts a scrub drag: the playhead follows the pointer, snapping to clip edges, cuts and markers
 * unless Ctrl (Cmd) is held, and each move plays a slice of sound (`PreviewApi.scrub`, silent
 * while a recording runs). `target`'s left edge is time 0; the pointer is captured on it until the
 * release. Nothing is written to the project.
 */
export function useScrubDrag(): (down: PointerEvent, target: HTMLElement) => void {
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const compositionId = useOpenComposition()?.id;
  const snapCandidates = useSnapCandidates();

  return useCallback(
    (down, target) => {
      const { playback } = preview;
      const px = timeline.view.getState().pxPerSecond;
      target.setPointerCapture(down.pointerId);
      // The playhead is what moves, so it is no target: 0 stands in for it (already one).
      const candidates = compositionId ? snapCandidates(project.getState(), compositionId, 0) : [];
      const scrubTo = (event: PointerEvent) => {
        const time = Math.max(0, pxToTime(event.clientX - target.getBoundingClientRect().left, px));
        const free = event.ctrlKey || event.metaKey;
        playback.seek(free ? time : snapTime(time, candidates, pxToTime(SNAP_PX, px)));
        preview.scrub(playback.getTime());
      };
      scrubTo(down);
      const up = () => {
        target.removeEventListener("pointermove", scrubTo);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
      };
      target.addEventListener("pointermove", scrubTo);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    },
    [preview, project, timeline, compositionId, snapCandidates],
  );
}
