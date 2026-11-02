import { PlayButton } from "./PlayButton";
import { Timecode } from "./Timecode";
import { ViewerZoom } from "./ViewerZoom";

/** The bar under the preview: timecode, play/pause, viewer zoom and the format picker. */
export function Transport() {
  return (
    <div className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t border-border-strong bg-surface px-3">
      <Timecode />
      <div className="flex items-center gap-1.5">
        <PlayButton />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <ViewerZoom />
      </div>
    </div>
  );
}
