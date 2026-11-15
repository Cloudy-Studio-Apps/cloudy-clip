import { useStore } from "zustand";
import { useModule } from "@/core";
import { compositionMixOf, useOpenComposition } from "@/modules/project";
import { soundRef } from "../../sound.ref";
import { MasterBand } from "./MasterBand";
import { useLanePage } from "./lane.page.hook";
import { TrackLineLane } from "./TrackLineLane";

/**
 * The master's lane (`timelineOverlays`, the Sound page only): under the last track, a header
 * that says "Master" and a lane with the master's volume line, always in front and editable like
 * a track's (`TrackLineLane`: drag a point, double-click the line to add one, Delete removes the
 * selected point, Draw volume takes strokes), written with the same commands and `target:
 * "master"`. It is the line Touch and Latch write on the master strip; the master's fader is a
 * trim on it. The row sits where the last lane of the timeline ends (`MasterBand`).
 */
export function MasterLine() {
  const sound = useModule(soundRef);
  const open = useOpenComposition();
  const { root, headerWidth, pxPerSecond, layout, from, to } = useLanePage();
  const drawing = useStore(sound.view, (s) => s.tool === "draw");
  const line = open ? compositionMixOf(open).master.volumeLine : undefined;

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-[11]">
      <MasterBand headerWidth={headerWidth} />
      {open && (
        <TrackLineLane
          target="master"
          line={line}
          inFront
          drawing={drawing}
          headerWidth={headerWidth}
          pxPerSecond={pxPerSecond}
          from={from}
          to={to}
          layout={layout}
        />
      )}
    </div>
  );
}
