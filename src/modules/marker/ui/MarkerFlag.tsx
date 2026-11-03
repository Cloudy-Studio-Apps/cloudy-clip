import { memo, useRef } from "react";
import { useStore } from "zustand";
import { formatTimecode, useKernel, useModule, type Micros } from "@/core";
import { previewRef, seek } from "@/modules/preview";
import { frameDuration, projectRef, type Marker } from "@/modules/project";
import {
  pxToTime,
  SNAP_PX,
  timeToPx,
  useFlagRow,
  useHeaderWidth,
  useSnapCandidates,
} from "@/modules/timeline";
import { ContextMenu, Popover } from "@/ui";
import { markerRef } from "../marker.ref";
import { removeMarker, updateMarker } from "../marker.commands";
import { MARKER_HEX } from "../logic/markers";
import { startFlagDrag } from "./flag.gesture";
import { MarkerEditor } from "./MarkerEditor";

interface MarkerFlagProps {
  marker: Marker;
  pxPerSecond: number;
}

/**
 * One marker: a flag in the row the timeline gives flags (`useFlagRow`: the ruler, or the marks row
 * on the Sound page) and a faint line down the lanes. Click seeks to it, drag moves
 * it, double-click edits its note and color, right-click offers Edit and Delete.
 */
export const MarkerFlag = memo(function MarkerFlag({ marker, pxPerSecond }: MarkerFlagProps) {
  const { bus } = useKernel();
  const { ui } = useModule(markerRef);
  const project = useModule(projectRef).store;
  const { playback } = useModule(previewRef);
  const editing = useStore(ui, (s) => s.editing === marker.id);
  const headerWidth = useHeaderWidth();
  const snapCandidates = useSnapCandidates();
  const row = useFlagRow();
  const line = useRef<HTMLDivElement>(null);
  const left = (time: Micros) => `${headerWidth + timeToPx(time, pxPerSecond)}px`;
  const edit = (open: boolean) => ui.setState({ editing: open ? marker.id : null });
  const color = MARKER_HEX[marker.color];
  const label = `${formatTimecode(marker.time)}${marker.note ? ` · ${marker.note}` : ""}`;

  return (
    <div
      ref={line}
      className="pointer-events-none absolute inset-y-0 z-[36] w-0"
      style={{ left: left(marker.time) }}
    >
      <div
        className="absolute inset-y-0 left-0 w-px opacity-40"
        style={{ backgroundColor: color }}
      />
      {/* Sticks at its row's top, and starts there too (the margin), so it scrolls with nothing. */}
      <div className="sticky" style={{ top: row.top, marginTop: row.top, height: row.height }}>
        <ContextMenu
          items={[
            { label: "Edit marker", onSelect: () => edit(true) },
            {
              label: "Delete marker",
              destructive: true,
              onSelect: () => void bus.run(removeMarker, { markerIds: [marker.id] }),
            },
          ]}
        >
          <Popover
            open={editing}
            // A click on the flag seeks; only closing goes through the popover.
            onOpenChange={(open) => !open && edit(false)}
            trigger={
              <button
                type="button"
                title={label}
                aria-label={`Marker at ${label}`}
                className="pointer-events-auto -ml-[5px] mt-0.5 h-3 w-2.5 cursor-grab rounded-b-xs border border-border-strong"
                style={{ backgroundColor: color }}
                onDoubleClick={() => edit(true)}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  // The ruler under the flag would scrub (the marks row takes no scrub).
                  event.stopPropagation();
                  const state = project.getState();
                  const composition = state.compositions[marker.compositionId];
                  if (!composition) return;
                  const others = snapCandidates(state, composition.id, 0).filter(
                    (time) => time !== marker.time,
                  );
                  startFlagDrag({
                    down: event.nativeEvent,
                    start: marker.time,
                    frame: frameDuration(composition.format),
                    candidates: [...others, playback.getTime()],
                    threshold: pxToTime(SNAP_PX, pxPerSecond),
                    timeAtDelta: (px) => pxToTime(px, pxPerSecond),
                    place: (time) => {
                      if (line.current) line.current.style.left = left(time);
                    },
                    commit: (time) =>
                      void bus.run(updateMarker, { markerId: marker.id, time }).then((result) => {
                        // A refused move puts the flag back where the document has it.
                        if (!result.ok && line.current) line.current.style.left = left(marker.time);
                      }),
                    click: () => void bus.run(seek, { time: marker.time }),
                  });
                }}
              />
            }
          >
            <MarkerEditor
              marker={marker}
              onColor={(picked) => ui.setState({ lastColor: picked })}
            />
          </Popover>
        </ContextMenu>
      </div>
    </div>
  );
});
