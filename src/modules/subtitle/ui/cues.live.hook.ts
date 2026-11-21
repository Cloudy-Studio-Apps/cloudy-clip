import { useEffect, useMemo } from "react";
import { report, useKernel, useModule } from "@/core";
import { elementRef, setProps } from "@/modules/element";
import { createPropsLive, type PropsLive } from "@/modules/inspector";
import { previewRef } from "@/modules/preview";
import { formatOf, projectRef, type ClipId } from "@/modules/project";

/**
 * Live editing of the selected cues together: a drag shows on all of them, the release runs one
 * `element.setProps` on all of them. Values are read from the first.
 */
export function useCuesLive(clipIds: readonly ClipId[]): PropsLive {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const project = useModule(projectRef).store;
  const elements = useModule(elementRef);
  const key = clipIds.join(",");

  const live = useMemo(() => {
    const ids = key.split(",");
    return createPropsLive({
      preview: (patch) => ids.forEach((id) => preview.previewProps(id, patch)),
      read() {
        const state = project.getState();
        const first = state.clips[ids[0] ?? ""];
        return first ? elements.resolve(first, formatOf(state, first)) : null;
      },
      commit: (patch) =>
        bus.run(setProps, { clipIds: ids, patch, at: preview.playback.getTime() }).then(report),
    });
  }, [bus, elements, preview, project, key]);
  useEffect(() => () => live.dispose(), [live]);
  return live;
}
