import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { timeToPx, useFlagRow } from "@/modules/timeline";
import { soundRef } from "../../sound.ref";
import { useLanePage } from "./lane.page.hook";

/**
 * What Strip silence would cut, as bars in the ruler (the marks row on the Sound page) while its
 * dialog is open, only those near the viewport (`useLanePage`). They take no pointer. Redraws when
 * the cuts change or on a zoom, never per frame.
 */
export function SilenceCuts() {
  const view = useModule(soundRef).view;
  const cuts = useStore(view, (s) => s.silence?.cuts);
  const { root, headerWidth, pxPerSecond, from, to } = useLanePage();
  const row = useFlagRow();
  // Only the bars in the viewport and one either side are DOM nodes (rule 26).
  const seen = useMemo(
    () =>
      (cuts ?? [])
        .map((cut) => ({
          left: timeToPx(cut.start, pxPerSecond),
          width: Math.max(1, timeToPx(cut.end, pxPerSecond) - timeToPx(cut.start, pxPerSecond)),
        }))
        .filter((bar) => bar.left + bar.width >= from && bar.left <= to),
    [cuts, pxPerSecond, from, to],
  );
  if (!cuts) return null;
  return (
    <div ref={root} className="pointer-events-none absolute inset-y-0 left-0 z-[34] w-0">
      <div className="sticky" style={{ top: row.top, marginTop: row.top, height: row.height }}>
        {seen.map((bar, index) => (
          <div
            key={index}
            className="absolute bottom-0 h-1/2 bg-mark opacity-60"
            style={{ left: headerWidth + bar.left, width: bar.width }}
          />
        ))}
      </div>
    </div>
  );
}
