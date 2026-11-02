import { SquareSplitHorizontal, Trash2, Unlink } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import type { ModuleContext } from "@/core";
import { previewRef } from "@/modules/preview";
import { deleteClips, splitAt, unlinkClips } from "./timeline.commands";
import type { ClipActions, ClipMenuEntry, TimelineViewState } from "./timeline.types";

/** The entries of a clip's menu that the timeline's own commands run. */
export function clipMenu(ctx: ModuleContext, view: StoreApi<TimelineViewState>): ClipActions {
  return {
    id: "timeline.clip",
    items(clip) {
      const { selection: clipIds } = view.getState();
      const at = ctx.require(previewRef).playback.getTime();
      const entries: ClipMenuEntry[] = [];
      if (at > clip.start && at < clip.start + clip.duration) {
        entries.push({
          group: "edit",
          icon: SquareSplitHorizontal,
          label: "Split at playhead",
          shortcut: "S",
          onSelect: () => void ctx.bus.run(splitAt, { at, clipIds }),
        });
      }
      if (clip.linkId !== undefined) {
        entries.push({
          group: "edit",
          order: 10,
          icon: Unlink,
          label: "Unlink audio",
          onSelect: () => void ctx.bus.run(unlinkClips, { clipIds }),
        });
      }
      entries.push({
        group: "delete",
        order: 10,
        icon: Trash2,
        label: "Delete",
        shortcut: "Del",
        destructive: true,
        onSelect: () => void ctx.bus.run(deleteClips, { clipIds }),
      });
      return entries;
    },
  };
}
