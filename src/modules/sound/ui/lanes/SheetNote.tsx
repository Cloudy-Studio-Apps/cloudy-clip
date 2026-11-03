import { useStore } from "zustand";
import { formatTimecode, useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";

/** A length as minutes and seconds: `1:32` (`1:01:32` past an hour). */
function minutesSeconds(length: number): string {
  return formatTimecode(length)
    .replace(/\.\d+$/, "")
    .replace(/^0(?=\d)/, "");
}

/** "3 tracks, 1:32" at the right of the timeline's tools: the open composition's audio tracks and its length. */
export function SheetNote() {
  const open = useOpenComposition();
  const tracks = useStore(useModule(projectRef).store.api, (s) =>
    open ? open.trackOrder.filter((id) => s.tracks[id]?.kind === "audio").length : 0,
  );
  if (!open) return null;
  return (
    <span className="shrink-0 whitespace-nowrap px-1 font-mono text-sm text-muted-foreground">
      {tracks} {tracks === 1 ? "track" : "tracks"}, {minutesSeconds(open.duration)}
    </span>
  );
}
