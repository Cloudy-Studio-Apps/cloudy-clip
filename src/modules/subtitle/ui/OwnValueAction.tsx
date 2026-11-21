import { RotateCcw } from "lucide-react";
import { useStore } from "zustand";
import { report, useKernel, useModule } from "@/core";
import type { FieldAction, FieldActionProps } from "@/modules/inspector";
import { projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { IconButton } from "@/ui";
import { ownPaths } from "../logic/overrides";
import { resetToStyle } from "../subtitle.mark.commands";

/**
 * At the end of a cue's row whose value differs from its style: ◆ and Reset to style (on every
 * selected cue when the cue is one of them). Keyed values aren't the style's to give back.
 */
function OwnValue({ clip: subject, paths, values, disabled }: FieldActionProps) {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef).view;
  const clip = useStore(project.api, (s) => s.clips[subject.id]);
  const style = useStore(project.api, (s) =>
    clip?.subtitle ? s.subtitleStyles?.[clip.subtitle.styleId] : undefined,
  );
  if (!clip || !style) return null;
  const keyed = clip.animation ?? {};
  const own = ownPaths(values, style).filter((p) => paths.includes(p) && !(p in keyed));
  if (own.length === 0) return null;

  const reset = () => {
    const { clips } = project.getState();
    const selection = timeline.getState().selection;
    const clipIds = (selection.includes(clip.id) ? selection : [clip.id]).filter(
      (id) => clips[id]?.subtitle !== undefined,
    );
    void bus.run(resetToStyle, { clipIds, paths: own }).then(report);
  };

  return (
    <span className="flex items-center">
      <span aria-hidden className="text-2xs text-mark" title={`Its own value, not ${style.name}'s`}>
        ◆
      </span>
      <IconButton
        label={`Reset to ${style.name}`}
        disabled={disabled}
        className="!size-[18px] [&_svg]:!size-3"
        onClick={reset}
      >
        <RotateCcw />
      </IconButton>
    </span>
  );
}

/** The subtitle field action: a cue's own values, each with Reset to style. */
export const ownValueAction: FieldAction = {
  id: "subtitle.own",
  order: 90,
  appliesTo: (spec) => spec.multiline !== true,
  component: OwnValue,
};
