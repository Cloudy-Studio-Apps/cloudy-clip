import { ChevronLeft } from "lucide-react";
import { EmptyState, IconButton } from "@/ui";
import type { StickerQuery } from "../sticker.types";
import { StickerGrid } from "./StickerGrid";
import { useStickerList } from "./sticker.list.hook";

interface StickerListViewProps {
  title: string;
  query: StickerQuery;
  /** Shown above the grid, for art that needs attribution. */
  credit?: string;
  onBack?(): void;
}

/** A pack, a topic or search results as a full grid, with a way back. */
export function StickerListView({ title, query, credit, onBack }: StickerListViewProps) {
  const { hits, loading } = useStickerList(query);
  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        {onBack && (
          <IconButton label="Back to packs" onClick={onBack}>
            <ChevronLeft />
          </IconButton>
        )}
        <h3 className="truncate text-sm font-semibold">{title}</h3>
      </div>
      {credit && <p className="shrink-0 text-2xs text-subtle-foreground">{credit}</p>}
      {hits.length > 0 && <StickerGrid hits={hits} />}
      {!loading && hits.length === 0 && (
        <EmptyState title="No stickers found">Try another word or topic.</EmptyState>
      )}
    </>
  );
}
