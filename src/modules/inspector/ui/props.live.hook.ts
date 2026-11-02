import { useEffect, useMemo } from "react";
import { useKernel, useModule } from "@/core";
import { elementRef, resetProps, setProps } from "@/modules/element";
import { previewRef } from "@/modules/preview";
import { projectRef, type Clip, formatOf } from "@/modules/project";
import type { PropsLive } from "../inspector.types";
import { createPropsLive } from "../logic/live";

/**
 * Live editing of a clip's values for the inspector's fields: drag steps redraw the preview only
 * (no React state), the release runs one `element.setProps`, so a drag is one undo step.
 */
export function usePropsLive(clip: Clip): PropsLive {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const elements = useModule(elementRef);
  const id = clip.id;

  const live = useMemo(
    () =>
      createPropsLive({
        preview: (patch) => preview.previewProps(id, patch),
        read: () => {
          const state = project.getState();
          const now = state.clips[id];
          return now ? elements.resolve(now, formatOf(state, now)) : null;
        },
        commit: (patch) => bus.run(setProps, { clipIds: [id], patch }),
        reset: (paths) => bus.run(resetProps, { clipIds: [id], paths: [...paths] }),
      }),
    [bus, elements, preview, project, id],
  );
  useEffect(() => () => live.dispose(), [live]);
  return live;
}
