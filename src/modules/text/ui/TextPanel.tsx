import { Plus } from "lucide-react";
import { useKernel, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { Button } from "@/ui";
import { addText } from "../text.commands";
import { startTextDrag } from "./text.gesture";

/**
 * The Text tab: "Add text" puts a text at the playhead; the tile does the same on click, or
 * lands where it is dropped on the timeline.
 */
export function TextPanel() {
  const { bus } = useKernel();
  const timeline = useModule(timelineRef);
  const project = useModule(projectRef).store;

  const dropAt = (clientX: number, clientY: number) => {
    const target = timeline.dropTarget(clientX, clientY);
    if (!target) return;
    // Over an audio lane, keep the time but let the command pick a video track.
    const onVideo = project.getState().tracks[target.trackId]?.kind === "video";
    void bus.run(addText, { start: target.time, trackId: onVideo ? target.trackId : undefined });
  };

  return (
    <section className="flex h-full flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
          Text
        </h2>
        <Button
          variant="primary"
          size="sm"
          title="Add text at the playhead"
          onClick={() => void bus.run(addText, {})}
        >
          <Plus />
          Add text
        </Button>
      </div>
      <button
        type="button"
        title="Click to add at the playhead, or drag onto the timeline"
        className="grid h-16 cursor-grab place-items-center rounded-xs border border-border bg-surface-sunken text-lg font-bold text-foreground hover:bg-hover"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          startTextDrag(e.nativeEvent, {
            onClick: () => void bus.run(addText, {}),
            onDrop: dropAt,
          });
        }}
      >
        Text
      </button>
      <p className="text-2xs text-muted-foreground">
        Click to add at the playhead, or drag onto the timeline. Move it on the video like any clip.
      </p>
    </section>
  );
}
