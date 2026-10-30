import { useMemo } from "react";
import { useModule } from "@/core";
import { stickerPicture } from "../logic/picture";
import { stickerRef } from "../sticker.ref";
import type { StickerPackDefinition } from "../sticker.types";
import { useStickerList } from "./sticker.list.hook";

/** A pack: four of its stickers, its name and how many it has. A click opens it. */
export function PackCover({ pack, onOpen }: { pack: StickerPackDefinition; onOpen(): void }) {
  const stickers = useModule(stickerRef);
  const { hits } = useStickerList({ pack: pack.id });
  const cover = useMemo(() => {
    const picked = pack.cover?.flatMap((id) => hits.filter((hit) => hit.sticker.id === id));
    return (picked?.length ? picked : hits).slice(0, 4);
  }, [pack.cover, hits]);
  return (
    <button
      type="button"
      className="flex min-w-0 cursor-pointer flex-col gap-1 rounded-xs bg-surface-sunken p-1.5 text-left hover:bg-hover"
      onClick={onOpen}
    >
      <span className="grid aspect-square grid-cols-2 gap-0.5">
        {cover.map(({ sticker }) => {
          const picture = stickerPicture(stickers, pack.id, sticker);
          return picture ? (
            <img
              key={sticker.id}
              src={picture}
              alt=""
              draggable={false}
              className="size-full object-contain"
            />
          ) : (
            <span key={sticker.id} />
          );
        })}
      </span>
      <span className="truncate text-xs font-semibold">{pack.name}</span>
      <span className="text-2xs text-subtle-foreground">{hits.length} stickers</span>
    </button>
  );
}
