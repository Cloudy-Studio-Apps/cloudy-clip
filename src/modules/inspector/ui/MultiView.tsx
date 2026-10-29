import { Layers } from "lucide-react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { elementRef } from "@/modules/element";
import { projectRef, type ClipId } from "@/modules/project";
import { InspectorHeader } from "./InspectorHeader";

/** Several clips selected: which ones. */
export function MultiView({ clipIds }: { clipIds: readonly ClipId[] }) {
  const project = useModule(projectRef).store;
  const clips = useStore(project.api, (s) => s.clips);
  const tracks = useStore(project.api, (s) => s.tracks);
  // Media names come from the project's media.
  useStore(project.api, (s) => s.media);
  const elements = useModule(elementRef);

  return (
    <>
      <InspectorHeader
        badge={<Layers />}
        title={`${clipIds.length} clips selected`}
        subtitle="Split and Delete apply to all of them"
      />
      <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-2">
        {clipIds.map((id) => {
          const clip = clips[id];
          const name = !clip
            ? "Missing clip"
            : (elements.get(clip.kind)?.definition.display(clip, {
                project: project.getState(),
                track: tracks[clip.trackId],
              }).label ?? clip.kind);
          return (
            <li key={id} className="truncate px-1.5 py-1 text-sm text-muted-foreground">
              {name}
            </li>
          );
        })}
      </ul>
    </>
  );
}
