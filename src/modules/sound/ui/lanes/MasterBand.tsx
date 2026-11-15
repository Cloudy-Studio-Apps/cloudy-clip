import { useLayoutEffect, useRef } from "react";
import { TIMELINE_CONTENT, trackHeight } from "@/modules/timeline";

/** Space between the last track's lane and the master's. */
const GAP = 8;

/**
 * The master's row: a header that says "Master" and the lane's box (`data-master-lane`, which
 * `TrackLineLane` measures), placed under the last track lane of the timeline. It sits before the
 * line in the tree so it is placed before the line measures it.
 */
export function MasterBand({ headerWidth }: { headerWidth: number }) {
  const band = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = band.current;
    const content = element?.closest<HTMLElement>(TIMELINE_CONTENT);
    if (!element || !content) return;
    const lanes = [...content.querySelectorAll<HTMLElement>("[data-track-id]")];
    if (lanes.length === 0) {
      element.style.visibility = "hidden";
      return;
    }
    const bottom = Math.max(...lanes.map((lane) => lane.getBoundingClientRect().bottom));
    element.style.top = `${bottom - content.getBoundingClientRect().top + GAP}px`;
    element.style.visibility = "visible";
  });

  return (
    <div
      ref={band}
      data-master-lane=""
      className="invisible absolute inset-x-0 border-y border-border bg-lane"
      style={{ height: trackHeight("audio") }}
    >
      <div
        className="pointer-events-auto sticky left-0 z-20 flex h-full items-center border-r-[1.5px] border-r-subtle-foreground bg-muted px-2"
        style={{ width: headerWidth }}
      >
        <span className="truncate font-hand text-base font-bold text-foreground">Master</span>
      </div>
    </div>
  );
}
