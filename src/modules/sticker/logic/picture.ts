import type { StickerDefinition, StickerLibrary } from "../sticker.types";

/** What a tile shows for a sticker: its thumbnail, or its art when that is a picture. */
export function stickerPicture(
  library: StickerLibrary,
  pack: string,
  sticker: StickerDefinition,
): string | undefined {
  if (sticker.thumbnail) return sticker.thumbnail;
  const art = library.artOf(pack, sticker.id, {});
  return art?.type === "image" ? art.url : undefined;
}
