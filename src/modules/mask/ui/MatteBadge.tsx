import { useMemo } from "react";
import { Layers2 } from "lucide-react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { elementRef } from "@/modules/element";
import {
  matteTracks,
  projectRef,
  usableMatte,
  type ProjectState,
  type Track,
} from "@/modules/project";

const SEP = "\u0001";

/** A mark on a video track that other clips use as their matte; its tooltip names those clips. */
export function MatteBadge({ track }: { track: Track }) {
  const project = useModule(projectRef).store;
  const elements = useModule(elementRef);
  // One string, so the selector's result is stable.
  const names = useStore(project.api, (s: ProjectState) => {
    const composition = s.compositions[track.compositionId];
    if (track.kind !== "video" || !composition) return "";
    const mattes = matteTracks(s, composition);
    if (!mattes.has(track.id)) return "";
    const out: string[] = [];
    for (const id of composition.trackOrder) {
      const t = s.tracks[id];
      for (const clipId of t?.clipIds ?? []) {
        const clip = s.clips[clipId];
        if (!clip || usableMatte(clip, mattes) !== track.id) continue;
        const shown = elements.get(clip.kind)?.definition.display(clip, { project: s, track: t });
        out.push(shown?.label ?? clip.kind);
      }
    }
    return out.join(SEP);
  });
  const title = useMemo(() => `Matte for: ${names.split(SEP).join(", ")}`, [names]);
  if (!names) return null;
  return (
    <span title={title} aria-label={title} className="text-muted-foreground flex items-center">
      <Layers2 size={12} />
    </span>
  );
}
