import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { selectionSubject, timelineRef } from "@/modules/timeline";
import { ClipView } from "./ClipView";
import { MultiView } from "./MultiView";
import { ProjectView } from "./ProjectView";

/** The inspector: the project when nothing is selected, else the selected clip(s). */
export function InspectorPanel() {
  const selection = useStore(useModule(timelineRef).view, (s) => s.selection);
  // A linked picture + sound counts as one clip: show the one that was clicked.
  const subject = useStore(useModule(projectRef).store.api, (s) => selectionSubject(s, selection));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selection.length === 0 && <ProjectView />}
      {subject && <ClipView clipId={subject} />}
      {selection.length > 0 && !subject && <MultiView clipIds={selection} />}
    </div>
  );
}
