import { ZoomIn, ZoomOut } from "lucide-react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { IconButton } from "@/ui";
import { previewRef } from "../preview.ref";
import { MAX_ZOOM, MIN_ZOOM } from "../preview.viewport";

/** One step of the zoom buttons. */
const STEP = 1.25;

/** Viewer zoom: out, the current level (click to fit), in. Ctrl + wheel on the stage zooms too. */
export function ViewerZoom() {
  const { viewport } = useModule(previewRef);
  const zoom = useStore(viewport.store, (s) => s.zoom);
  const fitted = useStore(viewport.store, (s) => s.zoom === 1 && s.panX === 0 && s.panY === 0);

  return (
    <div className="flex items-center">
      <IconButton
        label="Zoom out (Ctrl + wheel)"
        disabled={zoom <= MIN_ZOOM}
        onClick={() => viewport.zoomBy(1 / STEP)}
      >
        <ZoomOut />
      </IconButton>
      <button
        type="button"
        title="Fit the frame in the panel"
        className="h-7 min-w-12 cursor-pointer rounded-sm px-1 font-mono text-xs text-muted-foreground hover:bg-hover hover:text-foreground"
        onClick={() => viewport.fit()}
      >
        {fitted ? "Fit" : `${Math.round(zoom * 100)}%`}
      </button>
      <IconButton
        label="Zoom in (Ctrl + wheel)"
        disabled={zoom >= MAX_ZOOM}
        onClick={() => viewport.zoomBy(STEP)}
      >
        <ZoomIn />
      </IconButton>
    </div>
  );
}
