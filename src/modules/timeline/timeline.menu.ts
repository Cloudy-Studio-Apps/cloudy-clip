import {
  ArrowLeftToLine,
  EyeOff,
  FolderSearch,
  Link,
  SquareSplitHorizontal,
  Trash2,
  Unlink,
} from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import type { ModuleContext } from "@/core";
import { revealMedia } from "@/modules/media";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import { linkPair, sameTiming, selectionSubject } from "./logic/links";
import {
  deleteClips,
  linkClips,
  rippleDelete,
  setClipsDisabled,
  splitAt,
  unlinkClips,
} from "./timeline.commands";
import type { ClipActions, ClipMenuEntry, TimelineViewState } from "./timeline.types";

/** The entries of a clip's menu that the timeline's own commands run. */
export function clipMenu(ctx: ModuleContext, view: StoreApi<TimelineViewState>): ClipActions {
  return {
    id: "timeline.clip",
    // Only its Split entry shows on a sound-only page: a cut changes no picture.
    scopes: ["all", "sound"],
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
          scopes: ["all", "sound"],
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
      const state = ctx.require(projectRef).store.getState();
      const pair = linkPair(state, clipIds);
      if (pair) {
        entries.push({
          group: "edit",
          order: 10,
          icon: Link,
          label: "Link audio",
          disabled: !sameTiming(pair),
          onSelect: () => void ctx.bus.run(linkClips, { clipIds }),
        });
      }
      const { mediaId } = clip;
      if (mediaId !== undefined && selectionSubject(state, clipIds) !== undefined) {
        entries.push({
          group: "library",
          icon: FolderSearch,
          label: "Show in Library",
          onSelect: () => void ctx.bus.run(revealMedia, { mediaId }),
        });
      }
      entries.push(
        {
          group: "edit",
          order: 20,
          icon: EyeOff,
          label: clip.disabled ? "Enable clip" : "Disable clip",
          onSelect: () => void ctx.bus.run(setClipsDisabled, { clipIds, disabled: !clip.disabled }),
        },
        {
          group: "delete",
          icon: ArrowLeftToLine,
          label: "Ripple delete",
          destructive: true,
          onSelect: () => void ctx.bus.run(rippleDelete, { clipIds }),
        },
      );
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
