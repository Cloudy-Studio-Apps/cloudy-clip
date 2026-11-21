import { useStore } from "zustand";
import { useModule } from "@/core";
import { clipPlacement, projectRef, useOpenFormat, type ClipId } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { toFramePoint, topmostAt, useVisibleLayers } from "@/modules/transform";
import { subtitleRef } from "../subtitle.ref";

/** The layer over the frame that finds the cue under a click. */
export function CuePicker() {
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const { view } = useModule(subtitleRef);
  const clips = useStore(project.api, (s) => s.clips);
  const layers = useVisibleLayers();
  const format = useOpenFormat();

  const cueAt = (e: React.MouseEvent<HTMLDivElement>): ClipId | undefined => {
    const cues = layers.filter((l) => !l.matte && clips[l.clipId]?.subtitle);
    const placements = cues.map((l) => clipPlacement(format, l.source, l.transform, l.fit));
    const point = toFramePoint(e.currentTarget, format, e.clientX, e.clientY);
    return cues[topmostAt(placements, point)]?.clipId;
  };

  return (
    <div
      className="absolute inset-0"
      onClick={(e) => {
        const id = cueAt(e);
        if (!id) return;
        timeline.selectClip(id);
        view.setState({ tab: "cue" });
      }}
      onDoubleClick={(e) => {
        const id = cueAt(e);
        if (id) view.setState({ focus: { clipId: id, caret: "end" } });
      }}
    />
  );
}
