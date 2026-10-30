import { useEffect, useMemo, useReducer } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { stickerRef } from "../sticker.ref";
import type { StickerHit } from "../sticker.types";

/** The recently used stickers still in a pack, loading the packs they come from. */
export function useRecentStickers(): StickerHit[] {
  const stickers = useModule(stickerRef);
  const recents = useStore(stickers.recents.store, (state) => state.recents);
  const [loads, onLoaded] = useReducer((count: number) => count + 1, 0);

  useEffect(() => stickers.onLoaded(onLoaded), [stickers]);
  useEffect(() => {
    for (const { pack } of recents) void stickers.load(pack);
  }, [stickers, recents]);

  return useMemo(() => {
    void loads; // A list that loaded may hold more of them.
    return recents.flatMap(({ pack, sticker }) => {
      const found = stickers.find(pack, sticker);
      return found ? [{ pack, sticker: found }] : [];
    });
  }, [stickers, recents, loads]);
}
