import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { useTimelineScope } from "@/modules/timeline";
import { soundRef } from "../../sound.ref";
import { useLanePage } from "./lane.page.hook";
import { TrackLineLane } from "./TrackLineLane";

/**
 * The volume lines of the open composition's audio tracks (`timelineOverlays`, both pages), each
 * over its lane: faint and dashed behind the clips' lines, solid and editable when in front (L on
 * the header). With Draw volume on the Sound page, every audio lane takes strokes. Drawn for the
 * viewport and the one either side of it only, again when the scroll reaches another viewport, so
 * a long line costs what a screen of it does (`useLanePage`). The master has its own lane (`MasterLine`).
 */
export function TrackVolumeLine() {
  const project = useModule(projectRef).store;
  const sound = useModule(soundRef);
  const open = useOpenComposition();
  const scope = useTimelineScope();
  const tracks = useStore(project.api, (s) => s.tracks);
  const drawing = useStore(sound.view, (s) => s.tool === "draw") && scope === "sound";
  const lineView = useStore(sound.view, (s) => s.lineView);
  const audio = useMemo(
    () =>
      Object.values(tracks).filter(
        (track) => track.kind === "audio" && track.compositionId === open?.id,
      ),
    [tracks, open?.id],
  );
  const { root, headerWidth, pxPerSecond, layout, from, to } = useLanePage();

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-[11]">
      {audio.map((track) => {
        // In front only where L is: the Sound page. Edit draws every line behind.
        const inFront = scope === "sound" && (lineView[track.id] ?? false);
        if (!track.mix?.volumeLine && !inFront && !drawing) return null;
        return (
          <TrackLineLane
            key={track.id}
            target={track.id}
            line={track.mix?.volumeLine}
            inFront={inFront}
            drawing={drawing}
            headerWidth={headerWidth}
            pxPerSecond={pxPerSecond}
            from={from}
            to={to}
            layout={layout}
          />
        );
      })}
    </div>
  );
}
