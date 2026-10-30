import { Clapperboard, Star } from "lucide-react";
import { memo } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { startMediaDrag } from "@/modules/media";
import { placementsOf, projectRef, type Composition } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { cn, ContextMenu } from "@/ui";
import {
  deleteComposition,
  duplicateComposition,
  openComposition,
  setMain,
} from "../composition.commands";
import { compositionRef } from "../composition.ref";
import { formatLength } from "../logic/timecode";

/** One composition in the Library. Double-click opens it; drag it onto a timeline to place it. */
export const CompositionTile = memo(function CompositionTile({
  composition,
}: {
  composition: Composition;
}) {
  const { bus } = useKernel();
  const api = useModule(compositionRef);
  const timeline = useModule(timelineRef);
  const main = useStore(
    useModule(projectRef).store.api,
    (s) => s.mainCompositionId === composition.id,
  );
  const selected = useStore(api.ui, (s) => s.selected === composition.id);
  const placed = useStore(
    useModule(projectRef).store.api,
    (s) =>
      placementsOf(s, composition.id).filter((c) => s.tracks[c.trackId]?.kind === "video").length,
  );
  const { id, name, format, duration } = composition;
  const compositionId = id;

  return (
    <ContextMenu
      items={[
        { label: "Open", onSelect: () => void bus.run(openComposition, { compositionId }) },
        { label: "Composition Settings", onSelect: () => api.openSettings(id) },
        {
          label: "Set as Main",
          disabled: main,
          onSelect: () => void bus.run(setMain, { compositionId }),
        },
        {
          label: "Duplicate",
          onSelect: () => void bus.run(duplicateComposition, { compositionId }),
        },
        {
          label: "Delete",
          destructive: true,
          onSelect: () => void bus.run(deleteComposition, { compositionId }),
        },
      ]}
    >
      <button
        type="button"
        data-collab-target={`composition:${id}`}
        title={name}
        className={cn(
          "min-w-0 cursor-pointer rounded-sm border bg-surface-sunken p-1.5 text-left",
          selected ? "border-ring" : "border-primary/40 hover:border-primary",
        )}
        onPointerDown={(event) => {
          if (event.button === 0) {
            startMediaDrag({ type: "composition", id }, name, event.nativeEvent);
          }
        }}
        onClick={() => {
          timeline.selectClip(null);
          api.select(id);
        }}
        onDoubleClick={() => void bus.run(openComposition, { compositionId })}
      >
        <span className="mb-1 grid h-10 place-items-center rounded-xs bg-primary-soft text-primary-soft-foreground">
          <Clapperboard className="size-4" />
        </span>
        <span className="flex items-center gap-1 text-xs text-foreground">
          {main && <Star aria-label="Main" className="size-3 shrink-0 fill-current" />}
          <span className="truncate">{name}</span>
        </span>
        <span className="block truncate text-2xs text-muted-foreground">
          {format.width}×{format.height} · {formatLength(duration, format.fps)}
          {placed > 0 && ` · used ${placed}×`}
        </span>
      </button>
    </ContextMenu>
  );
});
