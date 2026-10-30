import { useEffect, useState } from "react";
import { useModule } from "@/core";
import { stickerRef } from "../sticker.ref";
import type { StickerHit, StickerQuery } from "../sticker.types";

/** The stickers matching a query. A slower answer to an older query is dropped. */
export function useStickerList({ text, topic, pack }: StickerQuery): {
  hits: readonly StickerHit[];
  loading: boolean;
} {
  const stickers = useModule(stickerRef);
  const [result, setResult] = useState<{ key: string; hits: readonly StickerHit[] }>();
  const key = JSON.stringify([text, topic, pack]);

  useEffect(() => {
    let stale = false;
    void stickers.search({ text, topic, pack }).then((hits) => {
      if (!stale) setResult({ key, hits });
    });
    return () => {
      stale = true;
    };
  }, [stickers, key, text, topic, pack]);

  const current = result?.key === key;
  return { hits: current ? result.hits : [], loading: !current };
}
