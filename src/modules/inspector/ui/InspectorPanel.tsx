import { useStore } from "zustand";
import { useModule } from "@/core";
import { timelineRef } from "@/modules/timeline";
import { ClipView } from "./ClipView";
import { MultiView } from "./MultiView";
import { ProjectView } from "./ProjectView";

/** The inspector: the project when nothing is selected, else the selected clip(s). */
export function InspectorPanel() {
  const selection = useStore(useModule(timelineRef).view, (s) => s.selection);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selection.length === 0 && <ProjectView />}
      {selection.length === 1 && selection[0] && <ClipView clipId={selection[0]} />}
      {selection.length > 1 && <MultiView clipIds={selection} />}
    </div>
  );
}
