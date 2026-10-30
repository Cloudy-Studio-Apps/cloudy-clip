import type { StickerHit, StickerQuery } from "../sticker.types";

/** The stickers matching every field of `query`, in the order given. */
export function searchStickers(hits: readonly StickerHit[], query: StickerQuery): StickerHit[] {
  const text = query.text?.trim().toLowerCase() ?? "";
  const found = hits.filter(({ pack, sticker }) => {
    if (query.pack && pack !== query.pack) return false;
    if (query.topic && !sticker.topics?.includes(query.topic)) return false;
    if (!text) return true;
    const words = [sticker.label, ...(sticker.keywords ?? [])];
    return words.some((word) => word.toLowerCase().includes(text));
  });
  return query.limit === undefined ? found : found.slice(0, query.limit);
}
