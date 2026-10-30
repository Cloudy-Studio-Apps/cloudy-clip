import { useMemo } from "react";
import { useModule } from "@/core";
import { stickerRef } from "../sticker.ref";
import { PackCover } from "./PackCover";
import { StickerTile } from "./StickerTile";
import { useRecentStickers } from "./sticker.recents.hook";

const HEADING = "text-2xs font-semibold uppercase tracking-[0.04em] text-muted-foreground";

/** What the tab opens on: the recently used stickers, then a cover for each pack. */
export function StickerHome({ onOpenPack }: { onOpenPack(id: string): void }) {
  const stickers = useModule(stickerRef);
  const recents = useRecentStickers();
  const packs = useMemo(() => stickers.packs(), [stickers]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden">
      {recents.length > 0 && (
        <>
          <h3 className={HEADING}>Recently used</h3>
          <div className="flex shrink-0 gap-1 overflow-x-auto">
            {recents.map((hit) => (
              <div key={`${hit.pack}:${hit.sticker.id}`} className="size-14 shrink-0">
                <StickerTile hit={hit} />
              </div>
            ))}
          </div>
        </>
      )}
      <h3 className={HEADING}>Packs</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {packs.map((pack) => (
          <PackCover key={pack.id} pack={pack} onOpen={() => onOpenPack(pack.id)} />
        ))}
      </div>
    </div>
  );
}
