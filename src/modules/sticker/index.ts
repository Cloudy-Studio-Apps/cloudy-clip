/**
 * Sticker module: stickers in packs, with topics and optional variations. Packs and styles come
 * through points, so a plugin's pack does everything a built-in one does.
 * @module sticker
 */
/** Points, their declare helpers and the built-in topics. */
export {
  STICKER_TOPICS,
  defineStickerPack,
  defineStickerStyle,
  stickerPacks,
  stickerStyles,
} from "./sticker.points";
/** Puts a sticker on the timeline. */
export { addSticker } from "./sticker.commands";
export type {
  StickerApi,
  StickerArt,
  StickerArtCache,
  StickerAxis,
  StickerDefinition,
  StickerHit,
  StickerLibrary,
  StickerOption,
  StickerPackDefinition,
  StickerProps,
  StickerQuery,
  StickerRecent,
  StickerRecents,
  StickerStyleDefinition,
  StickerTopic,
  StickerVariation,
} from "./sticker.types";

/** Module definition, loaded by the app shell. */
export { stickerModule } from "./sticker.module";
/** Handle for `require(stickerRef)` / `useModule(stickerRef)`. */
export { stickerRef } from "./sticker.ref";
