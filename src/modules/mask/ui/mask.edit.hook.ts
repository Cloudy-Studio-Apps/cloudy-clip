import { useEffect, useMemo } from "react";
import { notify, useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef, type ClipId, type MaskId } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";

/** What the Mask tab does for one clip: commands with failures as toasts, and live drag values. */
export function useMaskEdit(clipId: ClipId) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const project = useModule(projectRef).store;

  const edit = useMemo(() => {
    const run = async (id: string, input: unknown) => {
      const result = await bus.execute(id, input);
      if (!result.ok) notify("error", result.error.message);
      return result.ok ? { value: result.value } : undefined;
    };
    return {
      run,
      /** Draws a mask's values now without saving them (a slider mid-drag). */
      live: (maskId: MaskId, patch: Record<string, unknown>) =>
        preview.previewProps(clipId, { masks: { [maskId]: patch } }),
      clear: () => preview.previewProps(clipId, null),
      /** One `mask.update` at the playhead, then back to the saved picture. */
      async update(maskId: MaskId, patch: Record<string, unknown>) {
        const ok = await run("mask.update", {
          clipId,
          maskId,
          patch,
          at: preview.playback.getTime(),
        });
        preview.previewProps(clipId, null);
        return ok !== undefined;
      },
      now: () => preview.playback.getTime(),
      /** The clips an action on this tab reaches: the selected picture clips when they hold this one, else this one. */
      targets(): ClipId[] {
        const selected = timeline.view.getState().selection;
        if (!selected.includes(clipId)) return [clipId];
        const { clips, tracks } = project.getState();
        return selected.filter((id) => clips[id] && tracks[clips[id].trackId]?.kind === "video");
      },
    };
  }, [bus, clipId, preview, project, timeline]);

  // Escape mid-drag ends the slider with no release, so nothing else would clear the drawing.
  useEffect(() => edit.clear, [edit]);
  return edit;
}
