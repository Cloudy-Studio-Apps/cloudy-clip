import { useEffect, useMemo, useReducer } from "react";
import { useModule } from "@/core";
import { stickerRef } from "../sticker.ref";
import type { StickerAxis } from "../sticker.types";

/** The axes of a sticker worth choosing on: those with two options or more. */
export function useChoosableAxes(pack: unknown, sticker: unknown): StickerAxis[] {
  const stickers = useModule(stickerRef);
  const [loads, onLoaded] = useReducer((count: number) => count + 1, 0);
  const packId = String(pack);
  const stickerId = String(sticker);

  useEffect(() => stickers.onLoaded(onLoaded), [stickers]);
  useEffect(() => {
    void stickers.load(packId);
  }, [stickers, packId]);

  return useMemo(() => {
    void loads; // The axes are known once the pack's list has loaded.
    return stickers.axes(packId, stickerId).filter((axis) => axis.options.length > 1);
  }, [stickers, packId, stickerId, loads]);
}
