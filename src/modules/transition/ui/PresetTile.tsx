import { useRef } from "react";
import { useKernel, useModule, notify } from "@/core";
import { junctionRef } from "@/modules/junction";
import { projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { previewOnCut } from "../logic/preview";
import { applyTransition } from "../transition.apply.command";
import type { TransitionPresetDefinition } from "../transition.types";
import { startPresetDrag } from "./preset.gesture";
import { PresetThumbnail } from "./PresetThumbnail";
import { usePresetThumbnail } from "./thumbnail.hook";

/**
 * One preset: its thumbnail (animated while hovered) and name. A click applies it to the selected
 * cut, or to the cut after the selected clip; a drag drops it on a cut of the timeline.
 */
export function PresetTile({ preset }: { preset: TransitionPresetDefinition }) {
  const { bus } = useKernel();
  const timeline = useModule(timelineRef);
  const project = useModule(projectRef).store;
  const junctions = useModule(junctionRef);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnail = usePresetThumbnail(preset, canvasRef);

  const apply = () => {
    const { junctionSelection, selection } = timeline.view.getState();
    const state = project.getState();
    const junctionId = junctionSelection[0];
    // A video's picture and sound are selected together; only the picture can take a transition.
    const clipId =
      selection.find((id) => {
        const clip = state.clips[id];
        return clip !== undefined && state.tracks[clip.trackId]?.kind === "video";
      }) ?? selection[0];
    if (junctionId !== undefined) void bus.run(applyTransition, { preset: preset.id, junctionId });
    else if (clipId !== undefined) void bus.run(applyTransition, { preset: preset.id, clipId });
    else notify("info", "Select a clip or a cut first");
  };

  return (
    <button
      type="button"
      title="Click to apply to the selected cut, or drag onto a cut on the timeline"
      className="flex cursor-grab flex-col gap-1 rounded-xs border border-border bg-surface-sunken p-1 text-left hover:bg-hover"
      onPointerEnter={thumbnail.start}
      onPointerLeave={thumbnail.stop}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        startPresetDrag(e.nativeEvent, preset.name, {
          onClick: apply,
          cutAt: (x, y) => {
            const cut = timeline.cutTarget(x, y);
            const track = cut && project.getState().tracks[cut.trackId];
            const tracks = junctions.get("transition")?.definition.tracks;
            return cut && track && tracks?.includes(track.kind) ? cut : null;
          },
          onHover: (cut) => {
            const kind = junctions.get("transition")?.definition;
            if (!cut || !kind) return timeline.previewCut(null);
            const landing = previewOnCut(project.getState(), kind, cut);
            timeline.previewCut({ cut, label: preset.name, icon: kind.icon, ...landing });
          },
          onDrop: (cut) =>
            void bus.run(applyTransition, {
              preset: preset.id,
              leftClipId: cut.left.id,
              rightClipId: cut.right.id,
            }),
        });
      }}
    >
      <PresetThumbnail canvasRef={canvasRef} />
      <span className="truncate px-0.5 text-xs font-medium text-foreground">{preset.name}</span>
    </button>
  );
}
