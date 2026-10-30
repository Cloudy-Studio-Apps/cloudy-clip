import { useEffect, useMemo } from "react";
import { useModule, usePoint } from "@/core";
import { cn } from "@/ui";
import { stickerPacks } from "../sticker.points";
import { stickerRef } from "../sticker.ref";
import type { StickerPackDefinition, StickerView } from "../sticker.types";
import { useStickerList } from "./sticker.list.hook";

const ROW =
  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xs px-1.5 py-1 text-left text-sm hover:bg-hover";
const ACTIVE = "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft";
const HEADING = "px-1.5 text-2xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground";

function PackRow({
  pack,
  active,
  onPick,
}: {
  pack: StickerPackDefinition;
  active: boolean;
  onPick(): void;
}) {
  const { hits } = useStickerList({ pack: pack.id });
  return (
    <button type="button" className={cn(ROW, active && ACTIVE)} onClick={onPick}>
      <span className="truncate">{pack.name}</span>
      <span className="text-2xs text-subtle-foreground">{hits.length}</span>
    </button>
  );
}

interface StickerDrawerProps {
  view: StickerView;
  onPick(view: StickerView): void;
  onClose(): void;
}

/** Slides over the panel: every topic, and every installed pack with how many stickers it has. */
export function StickerDrawer({ view, onPick, onClose }: StickerDrawerProps) {
  const stickers = useModule(stickerRef);
  const contributed = usePoint(stickerPacks);
  const packs = useMemo(() => [...contributed].sort((a, b) => a.order - b.order), [contributed]);
  // Recomputed when a pack arrives: packs bring topics.
  const topics = useMemo(() => (contributed ? stickers.topics() : []), [stickers, contributed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="absolute inset-0 z-10 bg-black/35" onClick={onClose} />
      <nav
        aria-label="Sticker topics and packs"
        className="absolute inset-y-0 left-0 z-10 flex w-[170px] flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface-sunken p-2 shadow-popover"
      >
        <h3 className={HEADING}>Topics</h3>
        <button
          type="button"
          className={cn(ROW, view.kind === "all" && ACTIVE)}
          onClick={() => onPick({ kind: "all" })}
        >
          All
        </button>
        {topics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            className={cn(ROW, view.kind === "topic" && view.id === topic.id && ACTIVE)}
            onClick={() => onPick({ kind: "topic", id: topic.id })}
          >
            {topic.label}
          </button>
        ))}
        <h3 className={cn(HEADING, "mt-2")}>Installed</h3>
        {packs.map((pack) => (
          <PackRow
            key={pack.id}
            pack={pack}
            active={view.kind === "pack" && view.id === pack.id}
            onPick={() => onPick({ kind: "pack", id: pack.id })}
          />
        ))}
      </nav>
    </>
  );
}
