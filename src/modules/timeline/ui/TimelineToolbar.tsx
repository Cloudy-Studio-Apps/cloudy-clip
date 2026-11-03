import { Film, Music, Scissors, Trash, Unlink } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { ErrorBoundary, useKernel, useModule, usePoint } from "@/core";
import { previewRef } from "@/modules/preview";
import { partnersOf, projectRef } from "@/modules/project";
import { ToolbarButton, ToolbarSeparator } from "@/ui";
import { inScope, kindInScope } from "../logic/scope";
import { playheadSplit } from "../logic/split";
import { timelineTools } from "../timeline.points";
import { timelineRef } from "../timeline.ref";
import { addTrack, deleteClips, splitAt, unlinkClips } from "../timeline.commands";
import { PegBar } from "./PegBar";
import { useTimelineScope } from "./scope.hook";
import { ZoomSlider } from "./ZoomSlider";

/** Edit actions and zoom. Every button runs a command, exactly like shortcuts and agents. */
export function TimelineToolbar() {
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const { bus } = useKernel();
  const tools = usePoint(timelineTools);
  const scope = useTimelineScope();
  const ordered = useMemo(
    () => tools.filter((tool) => inScope(tool, scope)).sort((a, b) => a.order - b.order),
    [tools, scope],
  );
  const selection = useStore(timeline.view, (s) => s.selection);
  const canUnlink = useStore(useModule(projectRef).store.api, (s) =>
    selection.some((id) => partnersOf(s, id).length > 0),
  );

  return (
    <div className="relative flex h-[34px] shrink-0 items-center gap-1 overflow-x-auto border-b border-border-strong bg-muted px-2 [scrollbar-width:none]">
      <div className="flex shrink-0 items-center gap-0.5">
        {ordered.length > 0 && (
          <>
            {ordered.map(({ id, component: Tool }) => (
              <ErrorBoundary key={id} name={id}>
                <Tool />
              </ErrorBoundary>
            ))}
            <ToolbarSeparator />
          </>
        )}
        <ToolbarButton
          icon={<Scissors />}
          title="Split at playhead (S)"
          onClick={() => void bus.run(splitAt, playheadSplit(playback.getTime(), selection))}
        >
          Split
        </ToolbarButton>
        <ToolbarButton
          icon={<Trash />}
          title="Delete selected (Delete)"
          disabled={selection.length === 0}
          onClick={() =>
            void bus.run(deleteClips, { clipIds: selection, soundOnly: scope === "sound" })
          }
        >
          Delete
        </ToolbarButton>
        {scope !== "sound" && (
          <ToolbarButton
            icon={<Unlink />}
            title="Unlink picture and sound"
            disabled={!canUnlink}
            onClick={() => void bus.run(unlinkClips, { clipIds: selection })}
          >
            Unlink
          </ToolbarButton>
        )}
        <ToolbarSeparator />
        {kindInScope("video", scope) && (
          <ToolbarButton
            icon={<Film />}
            title="Add video track"
            onClick={() => void bus.run(addTrack, { kind: "video" })}
          >
            Video track
          </ToolbarButton>
        )}
        <ToolbarButton
          icon={<Music />}
          title="Add audio track"
          onClick={() => void bus.run(addTrack, { kind: "audio" })}
        >
          Audio track
        </ToolbarButton>
      </div>
      <div className="@container relative min-w-3 flex-1 self-stretch">
        <PegBar />
      </div>
      <ZoomSlider />
    </div>
  );
}
