import { Gauge } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { FloatingPanel } from "@/ui";
import { speedRef } from "../speed.ref";
import { SpeedFields } from "./SpeedFields";

/** The small box above a clip, open while the speed tools are on it. */
export function SpeedBox() {
  const { view } = useModule(speedRef);
  const timeline = useModule(timelineRef);
  const project = useModule(projectRef).store;
  const clipId = useStore(view, (s) => s.boxClipId);
  const exists = useStore(project.api, (s) => clipId !== null && s.clips[clipId] !== undefined);
  const close = useCallback(() => view.setState({ boxClipId: null }), [view]);
  const follow = useCallback((listener: () => void) => timeline.onScroll(listener), [timeline]);

  useEffect(() => {
    if (clipId !== null && !exists) close();
  }, [clipId, exists, close]);

  if (clipId === null || !exists) return null;
  return (
    <FloatingPanel
      label="Clip speed"
      anchor={() => timeline.clipBox(clipId)}
      follow={follow}
      onClose={close}
    >
      <div
        className="w-[272px]"
        onPointerUp={() => {
          // Space must play, and a focused slider would take the key.
          const focused = document.activeElement;
          if (focused instanceof HTMLInputElement && focused.type === "range") focused.blur();
        }}
      >
        <h2 className="mb-1 flex items-center gap-1.5 font-hand text-[13.5px] font-bold">
          <Gauge aria-hidden className="size-3.5" />
          Clip speed
        </h2>
        <SpeedFields clipId={clipId} bare />
      </div>
    </FloatingPanel>
  );
}
