import { useEffect, useMemo } from "react";
import { report, useKernel, useModule } from "@/core";
import { elementRef, mergeProps } from "@/modules/element";
import { createPropsLive, type PropsLive } from "@/modules/inspector";
import { previewRef } from "@/modules/preview";
import { formatOf, projectRef, type SubtitleStyleId } from "@/modules/project";
import { restylePatch } from "../logic/overrides";
import { updateStyle } from "../subtitle.style.commands";

/** Splits a style panel patch into what `subtitle.updateStyle` takes. */
function split(patch: Record<string, unknown>) {
  const { position, ...props } = patch;
  return { props, position: position as { x?: number; y?: number } | undefined };
}

/**
 * Live editing of a style's values: a drag shows on every cue that follows the style (its own
 * values and keyed fields stay, as the command will leave them), the release runs one
 * `subtitle.updateStyle`.
 */
export function useStyleLive(styleId: SubtitleStyleId): PropsLive {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const elements = useModule(elementRef);

  const live = useMemo(() => {
    const shown = new Set<string>();
    return createPropsLive({
      preview(patch) {
        for (const id of shown) preview.previewProps(id, null);
        shown.clear();
        const state = project.getState();
        const style = state.subtitleStyles?.[styleId];
        if (!patch || !style) return;
        const { props, position } = split(patch);
        const next = {
          ...style,
          props: mergeProps(style.props, props),
          position: { ...style.position, ...position },
        };
        for (const clip of Object.values(state.clips)) {
          if (clip.subtitle?.styleId !== styleId) continue;
          const values = elements.resolve(clip, formatOf(state, clip));
          const keyed = new Set(Object.keys(clip.animation ?? {}));
          const cue = restylePatch(values, style, next, keyed);
          if (Object.keys(cue).length === 0) continue;
          preview.previewProps(clip.id, cue);
          shown.add(clip.id);
        }
      },
      read() {
        const style = project.getState().subtitleStyles?.[styleId];
        return style ? { ...style.props, position: style.position } : null;
      },
      commit: (patch) => bus.run(updateStyle, { styleId, ...split(patch) }).then(report),
    });
  }, [bus, elements, preview, project, styleId]);
  useEffect(() => () => live.dispose(), [live]);
  return live;
}
