import { Play } from "lucide-react";
import { useModule } from "@/core";
import { stickerRef } from "../sticker.ref";
import type { StickerHit } from "../sticker.types";
import { useStickerPress } from "./sticker.add.hook";

/** One sticker: its picture, a mark when it moves. A click adds it; a drag drops it. */
export function StickerTile({ hit }: { hit: StickerHit }) {
  const stickers = useModule(stickerRef);
  const press = useStickerPress();
  const { pack, sticker } = hit;
  const art = stickers.artOf(pack, sticker.id, {});
  const picture = sticker.thumbnail ?? (art?.type === "image" ? art.url : undefined);
  return (
    <button
      type="button"
      title={sticker.label}
      aria-label={sticker.label}
      className="relative grid size-full cursor-grab place-items-center rounded-xs bg-surface-sunken hover:bg-hover"
      onPointerDown={(e) => {
        if (e.button === 0) press(e.nativeEvent, hit);
      }}
    >
      {picture && (
        <img
          src={picture}
          alt=""
          loading="lazy"
          draggable={false}
          className="size-3/4 object-contain"
        />
      )}
      {art?.type === "lottie" && (
        <Play className="absolute bottom-0.5 right-0.5 size-2.5 fill-current text-primary" />
      )}
    </button>
  );
}
