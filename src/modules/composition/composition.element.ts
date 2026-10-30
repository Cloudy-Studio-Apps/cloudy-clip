import { Clapperboard } from "lucide-react";
import { defineElement } from "@/modules/element";

/**
 * A composition placed on a timeline: a live mirror of it. A picture on a video track, placed
 * with the transform tools, or sound on an audio track. Drawn by the preview engine.
 */
export const compositionElement = defineElement({
  kind: "composition",
  name: "Composition",
  source: "composition",
  tracks: ["video", "audio"],
  supports: { transform: true },
  properties: {},
  defaults: () => ({}),
  display(clip, { project }) {
    const name = clip.compositionRef ? project.compositions[clip.compositionRef]?.name : undefined;
    return {
      icon: Clapperboard,
      color: "clip-composition",
      label: name ?? "Missing composition",
      body: "none",
    };
  },
  picture: { fit: "contain", source: "composition" },
});
