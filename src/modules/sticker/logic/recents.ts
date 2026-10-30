import type { StickerRecent } from "../sticker.types";

/** Stickers kept in the "Recently used" row. */
export const MAX_RECENT_STICKERS = 12;

/** `list` with `recent` first: a repeat moves to the front, and the list is capped. */
export function pushRecent(list: readonly StickerRecent[], recent: StickerRecent): StickerRecent[] {
  const others = list.filter((r) => r.pack !== recent.pack || r.sticker !== recent.sticker);
  return [recent, ...others].slice(0, MAX_RECENT_STICKERS);
}
