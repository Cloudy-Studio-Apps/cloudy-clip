import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { selectionSubject, timelineRef } from "@/modules/timeline";
import { ClipView } from "./ClipView";
import { JunctionView } from "./JunctionView";
import { MultiView } from "./MultiView";
import { ProjectView } from "./ProjectView";

/** The inspector: the project when nothing is selected, a selected junction, else the selected clip(s). */
export function InspectorPanel() {
  const view = useModule(timelineRef).view;
  const selection = useStore(view, (s) => s.selection);
  const junctionSelection = useStore(view, (s) => s.junctionSelection);
  const junctionId = junctionSelection.length === 1 ? junctionSelection[0] : undefined;
  // A linked picture + sound counts as one clip: show the one that was clicked.
  const subject = useStore(useModule(projectRef).store.api, (s) => selectionSubject(s, selection));

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selection.length === 0 && junctionId === undefined && <ProjectView />}
      {junctionId !== undefined && <JunctionView junctionId={junctionId} />}
      {subject && <ClipView clipId={subject} />}
      {selection.length > 0 && !subject && <MultiView clipIds={selection} />}
    </div>
  );
}
